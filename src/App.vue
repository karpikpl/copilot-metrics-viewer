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

        <v-form v-model="isConfigFormValid">

        <v-list-item>
          <v-list-item-content>
            <v-switch v-model="config.mockedData" :label="`Data: ${config.mockedData ? 'Mocked' : 'Real'}`"
              inset></v-switch>
          </v-list-item-content>
        </v-list-item>

        <div v-if="!config.mockedData">

          <v-list-item>
            <v-list-item-content>
              <v-switch v-model="useToken" :label="`Authentication: ${useToken ? 'Using Token' : 'GitHub login'}`"
                inset></v-switch>
            </v-list-item-content>
          </v-list-item>

          <v-list-item v-if="useToken">
            <v-list-item-content>
              <v-text-field hide-details="auto" label="token" clearable :rules="[rules.required, rules.token]"
               minLength="40"  maxlength="40" @input="debounce(() => { config.github.token = $event.target.value })"></v-text-field>
            </v-list-item-content>
          </v-list-item>

          <v-list-item v-if="!useToken">
            <v-list-item-content>
              <a href="/login" class="github-login-button">
                <v-icon left>mdi-github</v-icon>
                Sign in with GitHub
              </a>
            </v-list-item-content>
          </v-list-item>

          <v-list-item>
            <v-list-item-content>
              <v-switch v-model="isOrgSwitch" :label="`Scope: ${isOrgSwitch ? 'Organization' : 'Enterprise'}`"
                inset></v-switch>
            </v-list-item-content>
          </v-list-item>

          <v-list-item v-if="!isOrgSwitch">
            <v-list-item-title>Provide the Enterprise</v-list-item-title>
            <v-list-item-content>
              <v-text-field hide-details="auto" label="Enterprise" clearable :rules="[rules.required, rules.counter]"
                maxlength="60" @input="debounce(() => { config.github.ent = $event.target.value })"></v-text-field>
            </v-list-item-content>
          </v-list-item>

          <v-list-item>
            <v-list-item-title>Select organization</v-list-item-title>
            <v-list-item-content>
              <v-autocomplete :items="orgs" item-title="login" label="Organization" class="mx-4" solo
                :allow-overflow="false" v-model="config.github.org" :loading="fetchingOrgs">
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :subtitle="item.raw.description"></v-list-item>
                </template>
              </v-autocomplete>
            </v-list-item-content>
          </v-list-item>

          <v-spacer></v-spacer>

          <v-list-item>
            <v-list-item-title>Select Team</v-list-item-title>
            <v-list-item-content>
              <v-autocomplete :items="orgs" item-title="login" label="Team filter" class="mx-4" solo clearable>
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :subtitle="item.raw.description"></v-list-item>
                </template>
              </v-autocomplete>
            </v-list-item-content>
          </v-list-item>
        </div>
  </v-form>
      </v-list>
    </v-navigation-drawer>
    <v-main>
      <MainComponent :config="config" @toggle-drawer="toggleDrawer"/>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, ref, watch, computed} from 'vue'
import MainComponent from './components/MainComponent.vue'
import { getOrganizations, getOrganizationsForEnt, getTeams, Organization } from './api/GitHubApi';
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
      isOrgSwitch: configDefaults.scope.type === 'organization',
      fetchingOrgs: false,
      useToken: !configDefaults.github.useProxy,
      rules: {
        required: (value: string) => !!value || 'Required.',
        counter: (value: string) => value.length <= 60 || 'Max 60 characters',
        token: (value: string) => value.length === 40 || 'Token must be 40 characters long'
      }
    }
  },
  setup() {
    const config = ref<Config>(configDefaults);
    const isConfigFormValid = ref<boolean>(false);
    const selectedEnterprise = ref<string>(config.value.github.ent);
    const selectedOrg = ref<string>(config.value.github.org);
    const orgs = ref<Organization[]>([]);

    // Reactive computed property for config.isValid
    const isValid = computed(() => config.value.isValid);

    function createDebounce() {
      let timeout : number | undefined;
      return function (fnc: () => void, delayMs: number | undefined = 500) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          fnc();
        }, delayMs || 500);
      };
    }
    watch(
      () => config.value.mockedData,
      async (newVal, oldVal) => {
        if (newVal !== oldVal) {
          

          if(config.value.mockedData) {
            // Reset data
            orgs.value = [];
            config.value.github.org = 'octodemo';
            config.value.github.ent = '';
          }
          else {
          // Reset data
          orgs.value = [];
          config.value.github.org = '';
          config.value.github.ent = '';

            if (config.value.isValid) {
              await getOrganizations();
            }
          }

          console.log('config.mockedData changed', newVal);
          console.log('Configuration isValid flag is', config.value.isValid);

        }
      }
    );

    watch(
      () => config.value.github.token,
      async (newVal, oldVal) => {
        if (newVal !== oldVal && newVal.length === 40) {
          console.log('config.github.token changed', newVal);

         orgs.value = await getOrganizations();
        }
      }
    );

    // Watcher for isValid
    watch(isValid, (newVal, oldVal) => {
      if (newVal !== oldVal) {
        console.log('config.isValid changed to ', newVal);
        // Add your logic here
      } else
        console.log('config.isValid did not change, still ', newVal);
    });

    return {
      selectedOrg,
      selectedEnterprise,
      config,
      orgs,
      debounce: createDebounce(),
      isValid,
      isConfigFormValid
    }
  },
  methods: {
    toggleDrawer() {
      this.drawer = !this.drawer
    },
    async fetchOrganizations() {
      this.fetchingOrgs = true;
      const organizations = this.config.scope.type == 'organization' ? await getOrganizations() : await getOrganizationsForEnt(this.selectedEnterprise);
      this.fetchingOrgs = false;
      return organizations;
    },
    async getTeams() {
      console.log('getTeams', this.selectedOrg);
    },
    async tryFetchData() {
      console.log('tryFetchData');

      if (this.config.mockedData) {
        console.log('Mocked data - tell Main to refresh?');
      } else {
        if(this.isConfigFormValid) {
          console.log('Real data - get orgs');
        }
      }
    }
  },
  async mounted() {
    if (this.config.isValid) {
      this.orgs = await this.fetchOrganizations();
    }
  },
  watch: {
    async selectedOrg(newVal, oldVal) {
      if (newVal !== oldVal) {
        console.log('selectedOrg', newVal);
        // this.config.github.org = newVal;
      }
    },
    async selectedEnterprise(newVal, oldVal) {
      if (newVal !== oldVal) {
        console.log('selectedEnterprise', newVal);
        // this.config.github.ent = newVal;
        this.orgs = await this.fetchOrganizations();
      }
    },
    async isOrgSwitch(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.config.scope.type = this.isOrgSwitch ? 'organization' : 'enterprise';
      }
    },
    async isValid(newVal, oldVal) {
      console.log('config.isValid changed to ', newVal);
      // if (newVal !== oldVal) {
      //   if (newVal) {
      //     this.orgs = await this.getOrganizations();
      //   }
      // }
    }
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