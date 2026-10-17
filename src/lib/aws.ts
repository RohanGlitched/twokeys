import 'server-only';

/**
 * AWS settings for the app's own least-privilege user. Vercel reserves the AWS_* names, so
 * production uses APP_AWS_*; local development falls back to the standard variables.
 */
export function awsConfig() {
  const region = process.env.APP_AWS_REGION ?? process.env.AWS_REGION ?? 'ap-southeast-2';
  const id = process.env.APP_AWS_ACCESS_KEY_ID;
  const secret = process.env.APP_AWS_SECRET_ACCESS_KEY;
  return id && secret ? { region, credentials: { accessKeyId: id, secretAccessKey: secret } } : { region };
}
