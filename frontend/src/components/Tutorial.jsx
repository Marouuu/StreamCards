import { useState, useEffect } from 'react';
import './Tutorial.css';

const STEPS = [
  {
    title: 'Bienvenue sur StreamCards !',
    description: 'Collectionnez les cartes de vos streamers preferes, echangez-les avec vos amis et construisez la collection ultime.',
    icon: '🎴',
    highlight: null,
  },
  {
    title: 'Le Shop',
    description: 'Achetez des boosters avec vos coins pour obtenir de nouvelles cartes. Chaque booster contient des cartes de differentes raretees !',
    icon: '🛒',
    highlight: 'shop',
  },
  {
    title: 'Votre Collection',
    description: 'Retrouvez toutes vos cartes ici. Vous pouvez les recycler pour des coins ou les mettre en vente sur le marche.',
    icon: '📚',
    highlight: 'collection',
  },
  {
    title: 'Le Marche',
    description: 'Achetez et vendez des cartes avec les autres joueurs. Fixez vos prix et trouvez les cartes rares que vous cherchez.',
    icon: '💰',
    highlight: 'marketplace',
  },
  {
    title: 'Les Echanges',
    description: 'Proposez des echanges de cartes directement avec d\'autres joueurs. Negociez pour completer votre collection !',
    icon: '🔄',
    highlight: 'trades',
  },
  {
    title: 'Les Encheres',
    description: 'Mettez vos cartes rares aux encheres ou participez pour decrocher des cartes convoitees au meilleur prix.',
    icon: '🔨',
    highlight: 'auctions',
  },
  {
    title: 'Ajoutez des Amis',
    description: 'Retrouvez vos amis, chattez avec eux et suivez leur activite. Ouvrez le menu Amis depuis la barre de navigation !',
    icon: '👥',
    highlight: 'friends',
  },
  {
    title: 'C\'est parti !',
    description: 'Vous etes pret a commencer votre aventure. Dirigez-vous vers le Shop pour ouvrir votre premier booster !',
    icon: '🚀',
    highlight: null,
  },
];

function Tutorial({ onComplete, onNavigate }) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleSkip = () => {
    finish();
  };

  const finish = () => {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem('streamcards_tutorial_done', 'true');
      onComplete();
    }, 300);
  };

  return (
    <div className={`tutorial-overlay${exiting ? ' tutorial-exit' : ''}`}>
      <div className="tutorial-card">
        <button className="tutorial-skip" onClick={handleSkip}>
          Passer
        </button>

        <div className="tutorial-progress">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`tutorial-dot${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
            />
          ))}
        </div>

        <div className="tutorial-icon">{current.icon}</div>
        <h2 className="tutorial-title">{current.title}</h2>
        <p className="tutorial-desc">{current.description}</p>

        <div className="tutorial-actions">
          {step > 0 && (
            <button className="tutorial-btn tutorial-btn--secondary" onClick={handlePrev}>
              Precedent
            </button>
          )}
          <button className="tutorial-btn tutorial-btn--primary" onClick={handleNext}>
            {isLast ? 'Commencer !' : 'Suivant'}
          </button>
        </div>

        <span className="tutorial-step-count">{step + 1} / {STEPS.length}</span>
      </div>
    </div>
  );
}

export default Tutorial;
