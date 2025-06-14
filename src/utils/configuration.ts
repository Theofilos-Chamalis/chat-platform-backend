export const getConfiguration = () => {
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';

  let port: number;

  if (isProduction) {
    port = parseInt(process.env.PROD_PORT || '4050');
  } else {
    port = parseInt(process.env.DEV_PORT || '4040');
  }

  const https = process.env.HTTPS === 'true';
  const domain = process.env.DOMAIN || '';
  const ipAddress = process.env.IP_ADDRESS || 'localhost';
  const serverUrl = https ? 'https://' + domain : 'http://' + ipAddress;
  const certificatesPath = https ? '/etc/letsencrypt/live/' + domain : '';

  const dbHost = process.env.DB_HOST;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbPort = process.env.DB_PORT;
  const dbName = process.env.DB_NAME;
  const dbAuth = process.env.DB_AUTH;

  let connectionUrl: string = '';
  const dbAuthString =
    dbAuth?.toLowerCase() === 'true' ? `${dbUser}:${dbPassword}@` : '';

  const mongoOptimizations = [
    'retryWrites=true',
    'w=majority',
    'maxPoolSize=5',
    'minPoolSize=1',
    'maxIdleTimeMS=30000',
    'serverSelectionTimeoutMS=5000',
    'socketTimeoutMS=30000',
    'compressors=zstd',
  ].join('&');

  if (dbHost === 'localhost' || dbHost === '127.0.0.1') {
    connectionUrl = `mongodb://${dbAuthString}127.0.0.1:${dbPort}/${dbName}?${mongoOptimizations}`;
  } else {
    connectionUrl = `mongodb+srv://${dbAuthString}${dbHost}/${dbName}?${mongoOptimizations}`;
  }

  return {
    server: {
      environment,
      isProduction,
      port,
      domain,
      https,
      ipAddress,
      serverUrl,
      certificatesPath,
    },
    database: {
      host: dbHost,
      user: dbUser,
      password: dbPassword,
      port: dbPort,
      name: dbName,
      connectionUrl,
    },
  };
};
