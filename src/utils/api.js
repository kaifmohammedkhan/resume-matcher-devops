import axios from 'axios';

const API_BASE = '/api';

export const uploadResume = async (file) => {
  const formData = new FormData();
  formData.append('resume', file);
  const res = await axios.post(`${API_BASE}/upload`, formData);
  return res.data;
};

export const getJobDetail = async (id) => {
  const res = await axios.get(`${API_BASE}/job/${id}`);
  return res.data;
};