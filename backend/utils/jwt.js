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
    // Note: twitchAccessToken and coins are NOT stored in the JWT for security.
    // The access token is stored in the DB, and coins are always read from DB.
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d',
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

