export default () => ({
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    ttl: parseInt(process.env.REDIS_TTL, 10) || 300,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'change_this_in_production_min32chars!!',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change_this_in_prod_refresh_min32chars!!',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5,
    length: parseInt(process.env.OTP_LENGTH, 10) || 6,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'SKM Classes <noreply@skmclasses.in>',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    uploadDest: process.env.UPLOAD_DEST || './uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
    aws: {
      region: process.env.AWS_REGION || 'ap-south-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucket: process.env.AWS_S3_BUCKET,
      cloudfrontUrl: process.env.AWS_CLOUDFRONT_URL,
    },
  },

  graphql: {
    playground: process.env.GRAPHQL_PLAYGROUND === 'true',
    debug: process.env.GRAPHQL_DEBUG === 'true',
    introspection: process.env.GRAPHQL_INTROSPECTION !== 'false',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_SECONDS, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },

  institute: {
    name: process.env.INSTITUTE_NAME || 'SKM Classes',
    upiId: process.env.INSTITUTE_UPI_ID || 'skmclasses@upi',
    accountName: process.env.INSTITUTE_ACCOUNT_NAME || 'SKM Classes',
  },
});
