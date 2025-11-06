import axios from 'axios';

const TWITCH_API_BASE = 'https://api.twitch.tv/helix';

/**
 * Get followed channels from Twitch API
 */
export async function getFollowedChannels(accessToken, clientId, userId) {
  try {
    const response = await axios.get(`${TWITCH_API_BASE}/channels/followed`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
      params: {
        user_id: userId,
        first: 100, // Max 100 channels per request
      },
    });

    if (response.data.data) {
      return response.data.data.map(channel => ({
        id: channel.broadcaster_id,
        display_name: channel.broadcaster_name,
        profile_image_url: null, // Will need separate call for profile images
        thumbnail_url: null,
        viewer_count: null, // Will need separate call for viewer count
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching followed channels:', error.response?.data || error.message);
    throw new Error('Failed to get followed channels from Twitch');
  }
}

/**
 * Get user information (for profile images)
 */
export async function getUsersInfo(accessToken, clientId, userIds) {
  try {
    if (!userIds || userIds.length === 0) return [];
    
    // Twitch API allows max 100 IDs per request
    const batches = [];
    for (let i = 0; i < userIds.length; i += 100) {
      batches.push(userIds.slice(i, i + 100));
    }

    const allUsers = [];
    for (const batch of batches) {
      const response = await axios.get(`${TWITCH_API_BASE}/users`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': clientId,
        },
        params: {
          id: batch, // Array of user IDs
        },
      });

      if (response.data.data) {
        allUsers.push(...response.data.data);
      }
    }

    return allUsers;
  } catch (error) {
    console.error('Error fetching users info:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Get streams information (for viewer counts)
 */
export async function getStreamsInfo(accessToken, clientId, channelIds) {
  try {
    if (!channelIds || channelIds.length === 0) return [];
    
    const response = await axios.get(`${TWITCH_API_BASE}/streams`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
      params: {
        user_id: channelIds.slice(0, 100),
        first: 100,
      },
    });

    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching streams info:', error.response?.data || error.message);
    return [];
  }
}

