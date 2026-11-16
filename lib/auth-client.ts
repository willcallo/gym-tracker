'use client';

import { createAuthClient } from 'better-auth/react';

// No baseURL: the auth API is served from the same origin as the page.
export const authClient = createAuthClient();
