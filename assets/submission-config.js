// Local / branch deploy default. For production, prefer GitHub Actions (see README):
// repository secrets DISC_WEBHOOK_URL and DISC_WEBHOOK_TOKEN overwrite this file on deploy.
window.DISC_OWNER_SUBMISSION_CONFIG = {
  enabled: false,
  webhookUrl: "",
  webhookToken: "",
};
