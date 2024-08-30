// default values
const PROPS = ["MOCKED_DATA", "GITHUB_ORG", "GITHUB_ENT", "GITHUB_TEAM", "USE_PROXY"];


const env: any = {};
PROPS.forEach(prop => {
	const propName = `VUE_APP_${prop}`;
	if (process.env.NODE_ENV === "production") {
		env[propName] = (window as any)["_ENV_"][propName];
	}
	else {
		env[propName] = process.env[propName];
	}
});

const defaultScope = env.VUE_APP_GITHUB_ORG ? 'organization' : env.VUE_APP_GITHUB_ENT ? 'enterprise' : '';

const config: Config = {
	mockedData: env.VUE_APP_MOCKED_DATA === "true",
	scope: {
		type: defaultScope,
		get name() {
            switch (config.scope.type) {
				case 'organization':
					return config.github.org;
				case 'enterprise':
					return config.github.ent;
				default:
					return '';
			}
        }
	},
	github: {
		org: env.VUE_APP_GITHUB_ORG,
		ent: env.VUE_APP_GITHUB_ENT,
		team: env.VUE_APP_GITHUB_TEAM,
		token: env.VUE_APP_GITHUB_TOKEN,
		get apiUrl() {
			const baseApi = config.github.useProxy ? '/api/github' : 'https://api.github.com';

			if (config.scope.type === 'organization') {
				return `${baseApi || 'https://api.github.com'}/orgs/${config.github.org}`;
			}
			else if (config.scope.type === 'enterprise') {
				return `${baseApi || 'https://api.github.com'}/enterprises/${config.github.ent}`;
			}
			return '';
		},
		useProxy: env.VUE_APP_USE_PROXY === "true"
	},
	get isValid () {
		if (!config.scope.type) {
			console.error('config.scope.type missing');
			return false;
		}
		if (!config.github.org && !config.github.ent) {
			console.error('org or enterprise needs to be provided');
			return false;
		}
		if(config.mockedData || config.github.useProxy) {
			// for mock data or proxy we don't need a token
			return true;
		} else if (!config.github.token) {
			// we need the token for client-side requests
			return false;
		}
		return true;
	}
}

export default config;

export interface Config {
	mockedData: boolean;
	scope: {
		type: 'organization' | 'enterprise' | '';
		/** The GitHub organization or enterprise name. */
		name: string;
	};
	isValid: boolean;
	github: {
		/** The GitHub organization name. */
		org: string; 
		/** The GitHub enterprise name. */
		ent: string;
		/** The GitHub team name. */
		team: string;
		/** 
		 * The GitHub token to authenticate requests. 
		 * 
		 * CAUTION: Do not expose the token in the client-side code.
		 * */
		token: string;
		/**
		 * Flag to use the proxy to hide the token or run 100% client-side.
		 * 
		 * When true data apiUrl uses `/api/github` and the token is sent via proxy to the GitHub API.
		 * When false the token is sent from the client-side to the GitHub API https://api.github.com.
		 * 
		 */
		useProxy: boolean;
		/**
		 * The base URL for the GitHub API. When set to `/api/github` it sends data via proxy to the GitHub API to hide the token.
		 * 
		 * default: https://api.github.com
		 */
		apiUrl: string;
	}
}