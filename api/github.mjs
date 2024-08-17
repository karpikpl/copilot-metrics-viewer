import path from 'path';
import axios from 'axios';

class github {
    constructor() { }

    hello() {
        console.log("Hello from github");
    }

    buildRedirectUrl(host, hostname, state) {
        // https required for all non local environments
        const protocol = hostname == 'localhost' ? 'http' : 'https';
        const redirectUrl = `${protocol}://${host}/callback`;
        return `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&state=${state}&redirect_uri=${redirectUrl}`;
    }

    async exchangeCodeForToken(code) {
        const params = new URLSearchParams({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code,
        });

        try {
            const response = await axios.post('https://github.com/login/oauth/access_token', params, {
                headers: { 'Accept': 'application/json' }
            });

            if (response.status === 200) {
                return response.data;
            } else {
                console.log(response);
                return {};
            }
        } catch (error) {
            console.error('Error in exchangeCode:', error);
            return {};
        }
    }

    async refreshToken(refreshToken) {
        const params = new URLSearchParams({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        try {
            const response = await axios.post('https://github.com/login/oauth/access_token', params, {
                headers: { 'Accept': 'application/json' }
            });

            if (response.status === 200) {
                return response.data;
            } else {
                console.log('Error in refreshToken:', response.data);
                return {};
            }
        } catch (error) {
            console.error('Error in refreshToken:', error);
            return {};
        }
    }

    async getOrgs(token) {
        const installationsResponse = await axios.get('https://api.github.com/user/installations', {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        if (installationsResponse.status !== 200) {
            console.error('Error in /user/installations:', installationsResponse.status);
            return [];
        }

        const installations = installationsResponse.data.installations;
        const organizations = installations.map(installation => installation.account.login);
        return organizations;
    }

    async getTeams(token, org) {
        const teamsResponse = await axios.get(`https://api.github.com/orgs/${org}/teams`, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        if (teamsResponse.status !== 200) {
            console.error('Error in /orgs/{org}/teams:', teamsResponse.status);
            return [];
        }

        const teams = teamsResponse.data.map(team => team.slug);
        return teams;
    }
}

export default github;