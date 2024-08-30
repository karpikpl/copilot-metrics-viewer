<template>
  <v-card>
    <v-toolbar color="indigo" elevation="4">
      <v-btn icon @click="$emit('toggle-drawer')">
      <v-icon>mdi-menu</v-icon>
    </v-btn>
      <v-btn icon href="https://github.com/github-copilot-resources/copilot-metrics-viewer">
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-toolbar-title class="toolbar-title">Copilot Metrics Viewer | {{ capitalizedItemName }} : {{ displayedViewName }}
        {{ teamName }}
      </v-toolbar-title>

      <v-spacer></v-spacer>
      <h2 class="error-message"> {{ mockedDataMessage }} </h2>



      <template v-slot:extension>

        <v-tabs v-model="tab" align-tabs="title">
          <v-tab v-for="item in tabItems" :key="item" :value="item">
            {{ item }}
          </v-tab>
          <v-tab>


          </v-tab>
        </v-tabs>
        <div class="select-container"><v-select v-model="selectedTeam" :items="teams" label="Select Team" outlined dense
            class="team-select"></v-select></div>

      </template>

    </v-toolbar>

    <!-- API Error Message -->
    <div v-if="apiError" class="error-message" v-html="apiError"></div>
    <div v-if="apiError">
      <v-progress-linear v-if="!metricsReady" indeterminate color="indigo"></v-progress-linear>
      <v-window v-if="metricsReady" v-model="tab">
        <v-window-item v-for="item in tabItems" :key="item" :value="item">
          <v-card flat>
            <MetricsViewer v-if="item === itemName" :metrics="metrics" />
            <BreakdownComponent v-if="item === 'languages'" :metrics="metrics" :breakdownKey="'language'" />
            <BreakdownComponent v-if="item === 'editors'" :metrics="metrics" :breakdownKey="'editor'" />
            <CopilotChatViewer v-if="item === 'copilot chat'" :metrics="metrics" />
            <SeatsAnalysisViewer v-if="item === 'seat analysis'" :seats="seats" />
            <ApiResponse v-if="item === 'api response'" :metrics="metrics" :seats="seats" />
          </v-card>
        </v-window-item>
      </v-window>
    </div>

  </v-card>
</template>

<script lang='ts'>
import { defineComponent, ref, watch, onMounted } from 'vue'
import { getMetricsApi, getTeamMetricsApi, getTeams } from '../api/GitHubApi';
import { getSeatsApi } from '../api/ExtractSeats';
import { Metrics } from '../model/Metrics';
import { Seat } from "../model/Seat";

//Components
import MetricsViewer from './MetricsViewer.vue'
import BreakdownComponent from './BreakdownComponent.vue'
import CopilotChatViewer from './CopilotChatViewer.vue'
import SeatsAnalysisViewer from './SeatsAnalysisViewer.vue'
import ApiResponse from './ApiResponse.vue'
import config from '../config';

export default defineComponent({
  name: 'MainComponent',
  props: {
    drawer: {
      type: Boolean,
      required: true
    },
    selectedOrg: {
      type: String,
      required: false
    }
  },
  components: {
    MetricsViewer,
    BreakdownComponent,
    CopilotChatViewer,
    SeatsAnalysisViewer,
    ApiResponse
  },
  computed: {
    gitHubOrgName() {
      return config.github.org || this.selectedOrg;
    },
    itemName() {
      return config.scope.type;
    },
    capitalizedItemName(): string {
      return this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1);
    },
    displayedViewName(): string {
      return config.scope.name || this.gitHubOrgName || '';
    },
    isScopeOrganization() {
      return config.scope.type === 'organization';
    },
    teamName() {
      return this.selectedTeam ? `| Team : ${this.selectedTeam}` : '';
    },
    mockedDataMessage() {
      return config.mockedData ? 'Using mock data - see README if unintended' : '';
    }
  },
  data() {
    return {
      tabItems: ['languages', 'editors', 'copilot chat', 'api response'],
      tab: null,
      teams: [] as string[], // List of teams
      selectedTeam: '', // Selected team
      orgs: [] as string[], // List of organizations
    }
  },
  created() {
    this.tabItems.unshift(this.itemName);
    if (config.scope.type === 'organization') {
      // get the last item in the array,which is 'api response' 
      //and add 'seat analysis' before it
      let lastItem = this.tabItems.pop();
      this.tabItems.push('seat analysis');
      if (lastItem) {
        this.tabItems.push(lastItem);
      }
    }
    this.teams = config.github.teams || ['', 'Team A', 'Team B', 'Team C'];
    this.orgs = config.github.orgs || [];
    this.selectedTeam = '';
  },
  setup() {
    const metricsReady = ref(false);
    const metrics = ref<Metrics[]>([]);
    const seatsReady = ref(false);
    const seats = ref<Seat[]>([]);
    // API Error Message
    const apiError = ref<string | undefined>(undefined);
    const selectedTeam = ref<string>('');
    const teams = ref<string[]>([]);

    metricsReady.value = false;
    seatsReady.value = false;

    selectedTeam.value = '';

    const handleErrors = (error: any) => {
      console.error(error);
      // Check the status code of the error response
      if (error.response && error.response.status) {
        switch (error.response.status) {
          case 401:
            apiError.value = '401 Unauthorized access - check if your token in the .env file is correct.';
            break;
          case 404:
            apiError.value = `404 Not Found - is the ${config.scope.type} '${config.scope.name}' correct?`;
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

    // TODO - the steps should be:
    // 1. fetch enterprises (for enterprise scope - that's one enterprise, for org scope - that's none, for GitHub app - that's none, for OAuth app - that can be several)
    // 2. fetch orgs (for enterprise scope - that's all orgs in the enterprise, for org scope - that's one org, for GitHub app - that's all where app was installed, for OAuth app - that can be several in the enterprise)
    // 3. fetch teams (for enterprise scope - that's all teams in the enterprise, for org scope - that's all teams in the org, for GitHub app - that's all teams for selected org, for OAuth app - that can be several in the org or enterprise)
    // 4. fetch team data
    // 5. fetch seats data (org or enterprise scope)
    // 6. fetch metrics data

    const fetchTeams = () => {
      // this should get enterprise teams when enterprise is selected (or we have access to it via OAuth token)
      // or when the org is selected - this should get the teams for the org

      // the issue is that gitHubApi already has org or ent in the url
      getTeams().then(data => {
        teams.value = data;
      }).catch(handleErrors);
    }

    const fetchTeamData = () => {
      const teamPromise = selectedTeam.value !== '' ? getTeamMetricsApi(selectedTeam.value) : getMetricsApi();
      teamPromise.then(data => {
        metrics.value = data;

        // Set metricsReady to true after the call completes.
        metricsReady.value = true;
      }).catch(handleErrors);
    }

    // Watch for changes in selectedTeam
    watch(selectedTeam, (newVal, oldVal) => {
      if (newVal !== oldVal) {
        fetchTeamData();
      }
    });

    // Call fetchMetrics on component mount
    onMounted(() => {
      fetchTeamData();
    });

    getSeatsApi().then(data => {
      seats.value = data;

      // Set seatsReady to true after the call completes.
      seatsReady.value = true;

    }).catch(handleErrors);

    return { metricsReady, metrics, seatsReady, seats, apiError };
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

.team-select {
  max-width: 200px;
  min-width: 150px;
  /* Adjust the width as needed */
  /*margin-right: 16px;
  /* Add some margin to the right */
}
.select-container {
  position: absolute;
  right: 10px; /* Adjust the right margin as needed */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  height: 100%; /* Ensure it takes the full height of the parent */
}
</style>