//Make a call to the GitHub API to get Copilot Metrics, the API is https://api.github.com/orgs/toussaintt/copilot/usage
//Add the header Accept: application/vnd.github+json to the request
//Add also the Authorization: Bearer <token> header where <token> is hardcoded for now
//Also add X-GitHub-Api-Version: 2022-11-28 header
//Return the response from the API

import axios from "axios";

import { Metrics } from "../model/Metrics";
import organizationMockedResponse from '../assets/organization_response_sample.json';
import enterpriseMockedResponse from '../assets/enterprise_response_sample.json';
import config from '../config';

interface OrganizationFull {
  organization: {
    login: string;
    description: string;
  };
  role: string;
  state: string;
}

export interface Organization {
  login: string;
  description: string;
}

export const getMetricsApi = async (): Promise<Metrics[]> => {

  let response;
  let metricsData;

  if (config.mockedData) {
    console.log("Using mock data. Check VUE_APP_MOCKED_DATA variable.");
    response = config.scope.type === "organization" ? organizationMockedResponse : enterpriseMockedResponse;
    metricsData = response.map((item: any) => new Metrics(item));
  } else {
    response = await axios.get(
      `${config.github.apiUrl}/copilot/usage`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.github.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );


    metricsData = response.data.map((item: any) => new Metrics(item));
  }
  return metricsData;
};

export const getTeams = async (): Promise<string[]> => {
  const response = await axios.get(`${config.github.apiUrl}/teams`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.github.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  return response.data;
}

export const getOrganizations = async (): Promise<Organization[]> => {

  if (config.mockedData) {
    console.log("Using mock data. Check VUE_APP_MOCKED_DATA variable.");
    return [
      {login: 'octodemo', description: 'GitHub Demo Organization'},
    ];
  }

  const response = await axios.get(`https://api.github.com/user/memberships/orgs`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.github.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const organizations: OrganizationFull[] = response.data;

  // Filter organizations where the user has an admin role
  const adminOrganizations = organizations
    .filter(org => org.role === 'admin')
    .map(org => {
      return {
        login: org.organization.login,
        description: org.organization.description
      }
    });

  return adminOrganizations;
}

export const getOrganizationsForEnt = async (ent: string): Promise<Organization[]> => {

  // todo: make a graphql query to get the organizations for the enterprise
  return [
    {login: '<all>', description: 'All organizations in the enterprise'},
  ];
}

export const getTeamMetricsApi = async (team: string): Promise<Metrics[]> => {
  console.log("config.github.team: " + team);

  if (team && team.trim() !== '') {
    const response = await axios.get(
      `${config.github.apiUrl}/team/${team}/copilot/usage`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.github.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    return response.data.map((item: any) => new Metrics(item));
  }

  return [];

}