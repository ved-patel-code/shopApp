import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://127.0.0.1:8000", // Your backend URL
  headers: {
    "Content-Type": "application/json",
  },
});

// This is an "interceptor" that runs before each request is sent.
apiClient.interceptors.request.use(
  (config) => {
    // Retrieve the token from localStorage
    const token = localStorage.getItem("accessToken");
    if (token) {
      // If the token exists, add it to the Authorization header
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);



export default apiClient;

