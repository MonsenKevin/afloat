import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

const apiClient = axios.create({ baseURL: BASE_URL });

apiClient.interceptors.request.use(async (config) => {
  try {
    const result = await chrome.storage.local.get(['afloat_token']);
    if (result.afloat_token) {
      config.headers.Authorization = `Bearer ${result.afloat_token as string}`;
    }
  } catch {
    // not in extension context (e.g. tests)
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: { response?: { status?: number } }) => {
    if (error.response?.status === 401) {
      try {
        await chrome.storage.local.remove(['afloat_token', 'afloat_user']);
        window.location.reload();
      } catch {
        // not in extension context
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
