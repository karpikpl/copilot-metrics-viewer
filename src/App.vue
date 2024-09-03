<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app color="indigo" elevation="8">
      <v-list-item title="Settings" nav>
        <template v-slot:append>
          <v-btn icon="mdi-chevron-left" variant="text" @click.stop="toggleDrawer"></v-btn>
        </template>
      </v-list-item>
      <v-divider></v-divider>
      <v-list density="comfortable">

        <v-form v-model="isConfigFormValid" ref="configForm">

          <v-list-item>
            <v-switch v-model="config.mockedData" :label="`Data: ${config.mockedData ? 'Mocked' : 'Real'}`"
              inset></v-switch>
          </v-list-item>

          <div v-if="!config.mockedData">

            <v-list-item>
              <v-switch v-model="useToken" :label="`Authentication: ${useToken ? 'Using Token' : 'GitHub login'}`" inset
                :disabled="!gitHubLoginEnabled"></v-switch>
            </v-list-item>

            <v-list-item v-if="useToken">
              <v-text-field :append-inner-icon="tokenVisible ? 'mdi-eye-off' : 'mdi-eye'"
                :type="tokenVisible ? 'text' : 'password'" @click:append-inner="tokenVisible = !tokenVisible"
                hide-details="auto" label="token" clearable :rules="[rules.required, rules.token]" minLength="40"
                maxlength="100" v-debounce:1s="tokenChanged" v-model="config.github.token"></v-text-field>
            </v-list-item>

            <v-list-item v-if="!useToken">
              <a href="/login" class="github-login-button">
                <v-icon left>mdi-github</v-icon>
                Sign in with GitHub
              </a>
            </v-list-item>

            <v-list-item>
              <v-switch v-model="isOrgSwitch" :label="`Scope: ${isOrgSwitch ? 'Organization' : 'Enterprise'}`"
                inset></v-switch>
            </v-list-item>

            <v-list-item v-if="!isOrgSwitch" title="Provide the Enterprise">
              <v-text-field hide-details="auto" label="Enterprise" clearable :rules="[rules.required, rules.counter]"
                maxlength="60" v-debounce:1s="enterpriseChanged" v-model="config.github.ent"></v-text-field>
            </v-list-item>

            <v-list-item title="Select organization">
              <v-autocomplete :items="orgs" item-title="login" label="Organization" class="mx-4" solo
                :allow-overflow="false" v-model="config.github.org" :loading="fetchingOrgs" :rules="[rules.required]">
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :subtitle="item.raw.description"></v-list-item>
                </template>
              </v-autocomplete>
            </v-list-item>

            <v-spacer></v-spacer>

            <v-list-item title="Select Team">
              <v-autocomplete :items="teams" item-title="slug" label="Team filter" class="mx-4" solo clearable
              v-model="config.github.team">
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :subtitle="item.raw.name"></v-list-item>
                </template>
              </v-autocomplete>
            </v-list-item>
          </div>
        </v-form>
      </v-list>
    </v-navigation-drawer>
    <v-main>
      <MainComponent :config="config" @toggle-drawer="toggleDrawer" />
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import MainComponent from './components/MainComponent.vue'
import { getOrganizations, getOrganizationsForEnt, getTeams, Organization, Team } from './api/GitHubApi';
import configDefaults from './config';
import { Config } from './config';

export default defineComponent({
  name: 'App',

  components: {
    MainComponent,
  },

  data() {
    return {
      drawer: configDefaults.isValid,
      tokenVisible: false,
      isOrgSwitch: configDefaults.scope.type === 'organization',
      useToken: !configDefaults.github.useProxy,
      rules: {
        required: (value: string) => !!value || 'Required.',
        counter: (value: string) => value.length <= 60 || 'Max 60 characters',
        token: (value: string) => (value.length >= 40 && value.length <= 100) || 'Token must be between 40 and 100 characters long'
      }
    }
  },
  setup() {
    const config = ref<Config>(configDefaults);
    const isConfigFormValid = ref<boolean>(false);
    const selectedEnterprise = ref<string>(config.value.github.ent);
    const selectedOrg = ref<string>(config.value.github.org);
    const orgs = ref<Organization[]>([]);
    const teams = ref<Team[]>([]);
    const fetchingOrgs = ref<boolean>(false);
    const fetchingTeams = ref<boolean>(false);
    const configForm = ref<any | null>(null);
    const gitHubLoginEnabled = ref<boolean>(config.value.github.useProxy);
    configForm.value?.validate();

    // watch mock data switch
    watch(
      () => config.value.mockedData,
      async (newVal, oldVal) => {
        if (newVal !== oldVal) {
          configForm.value?.validate();

          if (config.value.mockedData) {
            // Reset data
            orgs.value = [];
            teams.value = [];
            config.value.github.org = 'octodemo';
            config.value.github.ent = 'octodemo';

            refreshMain();
          }
          else {
            // Reset data
            orgs.value = [];
            teams.value = [];
            config.value.github.org = '';
            config.value.github.ent = '';

            // get orgs if we have a "valid" token
            if (config.value.github.token && config.value.github.token.length >= 40) {
              await fetchOrganizations();
            }
          }

          console.log('config.mockedData changed', newVal);
          console.log('Configuration isValid flag is', config.value.isValid);
          // todo: check if valid before calling refresh
          refreshMain();
        }
      }
    );

    async function tokenChanged(newVal: string) {
      if (newVal && newVal.length >= 40) {
        await fetchOrganizations();
      }
    }

    watch(
      () => config.value.github.org,
      async (newVal) => {

        console.log('selected new org', newVal);
        console.log('config is valid:', config.value.isValid);
        teams.value = [];

        if (config.value.github.org == '<all>') {
          // if all orgs are selected, we need to set the scope to the enterprise
          config.value.scope.name = config.value.github.ent;
        } else {
          config.value.scope.name = config.value.github.org;
        }

        if(isConfigFormValid.value && config.value.isValid) {
          // fetch teams but not wait
          fetchTeams();
        }

        refreshMain();
      }
    );

    watch(
      () => config.value.github.team,
      async (newVal) => {
        console.log('selected new team', newVal);
        console.log('config is valid:', config.value.isValid);

        refreshMain();
      }
    );


    async function enterpriseChanged(newVal: string) {
      config.value.github.ent = newVal;
      console.log('selected new ent', newVal);
      console.log('config is valid:', config.value.isValid);

      await fetchOrganizations();

      if (config.value.github.org == '<all>') {
        // if all orgs are selected, we need to set the scope to the enterprise
        config.value.scope.name = config.value.github.ent;
      } else {
        config.value.scope.name = config.value.github.org;
      }
      refreshMain();
    }

    async function fetchOrganizations() {
      fetchingOrgs.value = true;
      const organizations = config.value.scope.type == 'organization' ? await getOrganizations() : await getOrganizationsForEnt(selectedEnterprise.value);
      fetchingOrgs.value = false;

      // set first org as default
      orgs.value = organizations;
      config.value.github.org = organizations[0].login;
    }

    async function fetchTeams() {
      fetchingTeams.value = true;
      // todo: get teams for enterprise ? for selected org?
      const teamsData = await getTeams();
      fetchingTeams.value = false;
      teams.value = teamsData;
    }

    function refreshMain() {
      console.log('refreshMain');
      const event = new CustomEvent('refresh-data');
      window.dispatchEvent(event);
    }

    return {
      selectedOrg,
      selectedEnterprise,
      config,
      orgs,
      teams,
      isConfigFormValid,
      fetchOrganizations,
      fetchingOrgs,
      configForm,
      gitHubLoginEnabled,
      enterpriseChanged,
      tokenChanged,
    }
  },
  methods: {
    toggleDrawer() {
      this.drawer = !this.drawer
    },

    async getTeams() {
      console.log('getTeams', this.selectedOrg);
    },
    async tryFetchData() {
      console.log('tryFetchData');

      if (this.config.mockedData) {
        console.log('Mocked data - tell Main to refresh?');
      } else {
        if (this.isConfigFormValid) {
          console.log('Real data - get orgs');
        }
      }
    }
  },
  async mounted() {
    if (this.config.isValid) {
      await this.fetchOrganizations();
    }
  },
  watch: {
    async selectedEnterprise(newVal, oldVal) {
      if (newVal !== oldVal) {
        console.log('in watch.selectedEnterprise', newVal);
        // this.config.github.ent = newVal;
        await this.fetchOrganizations();
      }
    },
    async isOrgSwitch(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.config.scope.type = this.isOrgSwitch ? 'organization' : 'enterprise';
        this.config.github.org = '';
        await this.fetchOrganizations();
      }
    },
  }


})
</script>
<style scoped>
.github-login-button {
  display: flex;
  align-items: center;
  background-color: #24292e;
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  text-decoration: none;
  font-weight: bold;
  font-size: 14px;
}

.github-login-button:hover {
  background-color: #444d56;
}

.github-login-button v-icon {
  margin-right: 8px;
}
</style>