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
    // Priorizar closingTime se disponível
    if (store.closingTime) {
      // Se já está no formato correto (ex: "22:00"), retornar direto
      if (store.closingTime.match(/^\d{2}:\d{2}$/)) {
        return store.closingTime;
      }
      // Se está em outro formato, tentar extrair
      const timeMatch = store.closingTime.match(/(\d{2}:\d{2})/);
      if (timeMatch) {
        return timeMatch[1];
      }
      return store.closingTime;
    }
    if (store.openingHours) {
      // Tentar extrair horário de fechamento do formato de horários
      // Ex: "08:00 - 22:00" ou "Seg-Sex: 08:00 às 22:00"
      const hoursMatch = store.openingHours.match(/(\d{2}:\d{2})/g);
      if (hoursMatch && hoursMatch.length > 1) {
        return hoursMatch[hoursMatch.length - 1]; // Último horário encontrado
      }
      // Se só tem um horário, pode ser o de fechamento
      if (hoursMatch && hoursMatch.length === 1) {
        return hoursMatch[0];
      }
    }
    return null;
  };

  const closingTime = getClosingTime();
  const hasInfo = closingTime || store.address;

  // Se não houver informações, não renderizar o componente
  // (mas isso pode ser configurado para sempre mostrar se necessário)
  if (!hasInfo) return null;

  // Formatar horário de fechamento
  const formatClosingTime = (time: string) => {
    if (!time) return null;
    // Se já está no formato HH:MM, retornar
    if (time.match(/^\d{2}:\d{2}$/)) {
      return time;
    }
    // Tentar extrair horário
    const timeMatch = time.match(/(\d{2}:\d{2})/);
    return timeMatch ? timeMatch[1] : time;
  };

  const formattedClosingTime = closingTime ? formatClosingTime(closingTime) : null;

  return (
    <>
      <div className="store-info-container">
        {/* Primeira linha: Localização */}
        {store.address && (
          <div className="store-info-line">
            <div className="store-info-location">
              <svg 
                className="store-info-location-icon" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
                  fill="currentColor"
                />
              </svg>
              <span className="store-info-address">{store.address}</span>
            </div>
            {(formattedClosingTime || store.openingHours || store.description) && (
              <>
                <span className="store-info-separator">•</span>
                <button 
                  className="store-info-more-link"
                  onClick={() => setIsModalOpen(true)}
                  aria-label="Ver mais informações sobre a loja"
                >
                  Mais informações
                </button>
              </>
            )}
          </div>
        )}

        {/* Segunda linha: Horário */}
        {formattedClosingTime && (
          <div className="store-info-line store-info-time-line">
            <span className="store-info-time">
              Aberto até {formattedClosingTime}
            </span>
          </div>
        )}
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

