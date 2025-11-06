import { CanvasTexture } from 'three';

// Card type definitions based on official card back designs
const cardTypes = {
  pokemon: {
    name: 'Pokemon',
    colors: {
      primary: '#4A90E2', // Blue (Pokemon card back blue)
      secondary: '#2E5C8A', // Darker blue
      accent: '#1E3A5F', // Deep blue
      border: '#1A1A1A', // Dark border
    },
  },
  magic: {
    name: 'Magic',
    colors: {
      primary: '#8B6F47', // Brown/tan (Magic card back)
      secondary: '#6B5638', // Darker brown
      accent: '#4A3D26', // Deep brown
      border: '#2F2418', // Dark brown border
    },
  },
  yugioh: {
    name: 'Yu-Gi-Oh',
    colors: {
      primary: '#1A1A2E', // Dark navy (Yu-Gi-Oh card back)
      secondary: '#0F0F1E', // Very dark
      accent: '#16213E', // Dark blue-gray
      border: '#000000', // Black border
    },
  },
};

// Generate a card texture using Canvas
function generateCardTexture(cardType, width = 256, height = 356) {
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    console.warn('Canvas not available, using fallback');
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn('Could not get 2d context');
    return null;
  }

  const type = cardTypes[cardType];
  if (!type) {
    console.warn(`Unknown card type: ${cardType}`);
    return null;
  }
  
  const colors = type.colors;

  // Background - solid color for card backs (more accurate)
  ctx.fillStyle = colors.primary;
  ctx.fillRect(0, 0, width, height);
  
  // Add subtle gradient overlay
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  // Inner border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  // Center pattern based on card type
  if (cardType === 'pokemon') {
    // Pokemon - Pokeball pattern in center
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 60;
    
    // Outer circle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner circle (top half red, bottom half white)
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.7, Math.PI, 0, false);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.7, 0, Math.PI, false);
    ctx.fill();
    
    // Center circle
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Horizontal line
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.7, centerY);
    ctx.lineTo(centerX + radius * 0.7, centerY);
    ctx.stroke();
  } else if (cardType === 'magic') {
    // Magic - ornate circular pattern
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Outer ornate circle
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 70, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inner pattern - mana symbols style
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const x = centerX + Math.cos(angle) * 40;
      const y = centerY + Math.sin(angle) * 40;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Center circle
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fill();
  } else if (cardType === 'yugioh') {
    // Yu-Gi-Oh - star pattern (pentagram)
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = 60;
    const innerRadius = 30;
    
    // Draw pentagram
    ctx.strokeStyle = '#FFD700';
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < 5; i++) {
      const angle1 = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const angle2 = ((i + 2) * Math.PI * 2) / 5 - Math.PI / 2;
      const x1 = centerX + Math.cos(angle1) * outerRadius;
      const y1 = centerY + Math.sin(angle1) * outerRadius;
      const x2 = centerX + Math.cos(angle2) * innerRadius;
      const y2 = centerY + Math.sin(angle2) * innerRadius;
      
      if (i === 0) {
        ctx.moveTo(x1, y1);
      } else {
        ctx.lineTo(x1, y1);
      }
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Bottom border/foil effect
  const bottomGradient = ctx.createLinearGradient(0, height - 60, 0, height);
  bottomGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  bottomGradient.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
  ctx.fillStyle = bottomGradient;
  ctx.fillRect(20, height - 60, width - 40, 40);

  // Create texture from canvas
  try {
    const texture = new CanvasTexture(canvas);
    texture.flipY = false; // Don't flip - canvas coordinates are correct
    texture.format = 1022; // RGBAFormat
    texture.needsUpdate = true;
    return texture;
  } catch (error) {
    console.error('Error creating texture:', error);
    return null;
  }
}

// Pre-generate textures for each card type
export function getCardTexture(cardType) {
  const types = Object.keys(cardTypes);
  const type = cardType || types[Math.floor(Math.random() * types.length)];
  return generateCardTexture(type);
}

export function getRandomCardType() {
  const types = Object.keys(cardTypes);
  return types[Math.floor(Math.random() * types.length)];
}

export { cardTypes };

