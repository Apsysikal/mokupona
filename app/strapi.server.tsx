export const API_URL = process.env.STRAPI_API_URL;
export const API_HEADERS = {
  Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
  "Content-Type": "application/json",
};
