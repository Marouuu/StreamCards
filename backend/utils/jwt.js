import jwt from 'jsonwebtoken';

/**
 * Generate JWT token for user (with Twitch data)
 */
export function generateToken(twitchUser, twitchAccessToken, coins = 0) {
  const payload = {
    twitchId: twitchUser.id,
    username: twitchUser.login,
    displayName: twitchUser.display_name,
    profileImageUrl: twitchUser.profile_image_url,
    twitchAccessToken: twitchAccessToken, // Store access token for API calls
    coins: coins, // Coins amount
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d', // Token expires in 7 days
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

