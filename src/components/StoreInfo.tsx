import React, { useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import StoreDetailsModal from './StoreDetailsModal';
import './StoreInfo.css';

const StoreInfo: React.FC = () => {
  const { store } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!store) return null;

  // Calcular horário de fechamento se disponível
  const getClosingTime = () => {
    if (store.closingTime) {
      return store.closingTime;
    }
    if (store.openingHours) {
      // Tentar extrair horário de fechamento do formato de horários
      const hoursMatch = store.openingHours.match(/(\d{2}:\d{2})/g);
      if (hoursMatch && hoursMatch.length > 1) {
        return hoursMatch[hoursMatch.length - 1]; // Último horário encontrado
      }
    }
    return null;
  };

  const closingTime = getClosingTime();
  const hasInfo = closingTime || store.address;

  if (!hasInfo) return null;

  return (
    <>
      <div className="store-info-container">
        {closingTime && (
          <div className="store-info-item">
            <span className="store-info-label">Aberto até</span>
            <span className="store-info-value">{closingTime}</span>
          </div>
        )}
        {store.address && (
          <div className="store-info-item">
            <span className="store-info-label">Localização</span>
            <span className="store-info-value">{store.address}</span>
          </div>
        )}
        <button 
          className="store-info-more-btn"
          onClick={() => setIsModalOpen(true)}
          aria-label="Ver mais informações sobre a loja"
        >
          Ver mais
        </button>
      </div>
      {isModalOpen && (
        <StoreDetailsModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};

export default StoreInfo;

