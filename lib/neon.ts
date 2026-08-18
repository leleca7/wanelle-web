import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL ?? 'https://ep-summer-cake-arp4ldto.neonauth.c-4.us-west-2.aws.neon.tech/neondb/auth';
const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL ?? 'https://ep-summer-cake-arp4ldto.apirest.c-4.us-west-2.aws.neon.tech/neondb/rest/v1';

export const neon = createClient<any>({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: authUrl,
  },
  dataApi: {
    url: dataApiUrl,
  },
});
