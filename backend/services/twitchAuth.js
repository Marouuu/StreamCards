import axios from 'axios';

const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USER_URL = 'https://api.twitch.tv/helix/users';
const TWITCH_FOLLOWS_URL = 'https://api.twitch.tv/helix/channels/followed';

/**
 * Generate Twitch OAuth authorization URL
 */
export function getTwitchAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'user:read:email user:read:follows', // Added scope for followed channels
    state: state,
  });

  return `${TWITCH_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(clientId, clientSecret, code, redirectUri) {
  try {
    const response = await axios.post(TWITCH_TOKEN_URL, null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      },
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);
    throw new Error('Failed to exchange authorization code');
  }
}

/**
 * Get Twitch user information
 */
export async function getTwitchUserInfo(accessToken, clientId) {
  try {
    const response = await axios.get(TWITCH_USER_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
    });

    if (response.data.data && response.data.data.length > 0) {
      return response.data.data[0];
    }
    throw new Error('No user data returned from Twitch');
  } catch (error) {
    console.error('Error getting Twitch user info:', error.response?.data || error.message);
    throw new Error('Failed to get user information from Twitch');
  }
}

