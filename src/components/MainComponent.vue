<template>
  <v-card>
    <v-toolbar color="indigo" elevation="4">
      <v-btn icon @click="$emit('toggle-drawer')">
        <v-icon :color="config.isValid ? 'default' : 'red'">
          {{ config.isValid ? 'mdi-menu' : 'mdi-alert-circle' }}
        </v-icon>
      </v-btn>
      <v-btn icon href="https://github.com/github-copilot-resources/copilot-metrics-viewer">
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-toolbar-title class="toolbar-title">Copilot Metrics Viewer | {{ capitalizedItemName }} : {{ displayedViewName
        }} {{ teamName }}
      </v-toolbar-title>
      <h2 class="error-message"> {{ mockedDataMessage }} </h2>
      <v-spacer></v-spacer>

      <template v-slot:extension>

        <v-tabs v-model="tab" align-tabs="title">
          <v-tab v-for="item in tabItems" :key="item.key" :value="item.key">
            {{ item.name }}
          </v-tab>
        </v-tabs>

      </template>

    </v-toolbar>

    <!-- API Error Message -->
    <div v-if="apiError" class="error-message" v-html="apiError"></div>
    <div v-if="!apiError">
      <v-progress-linear v-if="!metricsReady || !seatsReady || !config.isValid" indeterminate
        color="indigo"></v-progress-linear>
      <v-window v-if="metricsReady" v-model="tab">
        <v-window-item v-for="item in tabItems" :key="item.key" :value="item.key">
          <v-card flat>
            <MetricsViewer v-if="item.name === itemName" :metrics="metrics" />
            <BreakdownComponent v-if="item.name === 'languages'" :metrics="metrics" :breakdownKey="'language'" />
            <BreakdownComponent v-if="item.name === 'editors'" :metrics="metrics" :breakdownKey="'editor'" />
            <CopilotChatViewer v-if="item.name === 'copilot chat'" :metrics="metrics" />
            <SeatsAnalysisViewer v-if="item.name === 'seat analysis'" :seats="seats" />
            <ApiResponse v-if="item.name === 'api response'" :metrics="metrics" :seats="seats" />
          </v-card>
        </v-window-item>
      </v-window>
    </div>

  </v-card>
</template>

<script lang='ts'>
import { defineComponent, ref, PropType, onMounted, onUnmounted } from 'vue'
import { getMetricsApi } from '../api/GitHubApi';
import { getTeamMetricsApi } from '../api/GitHubApi';
import { getSeatsApi } from '../api/ExtractSeats';
import { Metrics } from '../model/Metrics';
import { Seat } from "../model/Seat";
import { Config } from '../config';

//Components
import MetricsViewer from './MetricsViewer.vue'
import BreakdownComponent from './BreakdownComponent.vue'
import CopilotChatViewer from './CopilotChatViewer.vue'
import SeatsAnalysisViewer from './SeatsAnalysisViewer.vue'
import ApiResponse from './ApiResponse.vue'

export default defineComponent({
  name: 'MainComponent',
  components: {
    MetricsViewer,
    BreakdownComponent,
    CopilotChatViewer,
    SeatsAnalysisViewer,
    ApiResponse
  },
  props: {
    config: {
      type: Object as PropType<Config>,
      required: true
    }
  },
  computed: {
    gitHubOrgName() {
      return this.config.github.org;
    },
    itemName() {
      return this.config.scope.type;
    },
    capitalizedItemName(): string {
      return this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1);
    },
    displayedViewName(): string {
      return this.config.scope.name;
    },
    teamName() {
      var teamName;
      if (this.config.github.team && this.config.github.team.trim() !== '') {
        teamName = "| Team : " + this.config.github.team;
      } else {
        teamName = '';
      }
      return teamName;
    },
    mockedDataMessage() {
      return this.config.mockedData ? 'Using mock data - see README if unintended' : '';
    },
    tabItems(): { name: string, key: string }[] {
      switch (this.config.scope.type) {
        case 'organization':
          return [
            { name: 'organization', key: 'metrics' }, { name: 'languages', key: 'lan' }, { name: 'editors', key: 'editors' }, { name: 'copilot chat', key: 'chat' }, { name: 'seat analysis', key: 'seats' }, { name: 'api response', key: 'api' }
          ];
        case 'enterprise':
          return [
            { name: 'enterprise', key: 'metrics' }, { name: 'languages', key: 'lan' }, { name: 'editors', key: 'editors' }, { name: 'copilot chat', key: 'chat' }, { name: 'api response', key: 'api' }
          ];
        default:
          return [];
      }
    }
  },
  data() {
    return {
      tab: null
    }
  },
  setup(props) {
    const metricsReady = ref(false);
    const metrics = ref<Metrics[]>([]);
    const seatsReady = ref(false);
    const seats = ref<Seat[]>([]);
    // API Error Message
    const apiError = ref<string | undefined>(undefined);

    const handleErrors = (error: any) => {
      console.error(error);
      // Check the status code of the error response
      if (error.response && error.response.status) {
        switch (error.response.status) {
          case 401:
            apiError.value = '401 Unauthorized access - check if your token in the .env file is correct.';
            break;
          case 404:
            apiError.value = `404 Not Found - is the ${props.config.scope.type} '${props.config.scope.name}' correct?`;
            break;
          default:
            apiError.value = error.message;
            break;
        }
      } else {
        // Update apiError with the error message
        apiError.value = error.message;
      }
      // Add a new line to the apiError message
      apiError.value += ' <br> If .env file is modified, restart the app for the changes to take effect.';
    }

    function refreshMain() {
      metrics.value = [];
      seats.value = [];
      metricsReady.value = false;
      seatsReady.value = false;
      apiError.value = undefined;

      if(!props.config.github.org) {
        return;
      }

      const metricsPromise = props.config.github.team && props.config.github.team.trim() !== '' 
        ? getTeamMetricsApi(props.config.github.team) 
        : getMetricsApi();

      metricsPromise.then(data => {
          metrics.value = data;
          metricsReady.value = true;
        }).catch(handleErrors);

      getSeatsApi().then(data => {
        seats.value = data;
        // Set seatsReady to true after the call completes.
        seatsReady.value = true;
      }).catch(handleErrors);
    }

    onMounted(() => {
      console.log('MainComponent mounted');
      window.addEventListener('refresh-data', refreshMain);
    });

    onUnmounted(() => {
      console.log('MainComponent unmounted');
      window.removeEventListener('refresh-data', refreshMain);
    });

    refreshMain();

    return { metricsReady, metrics, seatsReady, seats, apiError, refreshMain };
  }
})
</script>

<style scoped>
.toolbar-title {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
}

.error-message {
  color: red;
}
</style>