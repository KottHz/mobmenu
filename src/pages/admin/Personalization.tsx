import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import AdminLayout from '../../components/admin/AdminLayout';
import addImageIcon from '../../icons/addimage.svg';
import trashIcon from '../../icons/trash-svgrepo-com.svg';
import { deleteImageFromStorage } from '../../utils/storageHelper';
import { compressImageIfNeeded, compressBlobIfNeeded } from '../../utils/imageHelper';
import './Personalization.css';
import '../../components/PromoBanner.css';

export default function AdminPersonalization() {
  const { store, loading: storeLoading, loadStoreByAdminUser, reloadCustomizations } = useStore();
  const { user, loading: authLoading } = useAuth();
  const [message, setMessage] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageToEdit, setImageToEdit] = useState<string | null>(null);
  const [cropData, setCropData] = useState({ x: 0, y: 0, width: 450, height: 450 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, containerX: 0, containerY: 0 });
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);
  
  // Estados para PromoBanner
  const [promoBannerVisible, setPromoBannerVisible] = useState(true);
  const [promoBannerText, setPromoBannerText] = useState('ESQUENTA BLACK FRIDAY - ATÉ 60%OFF');
  const [promoBannerBgColor, setPromoBannerBgColor] = useState('#FDD8A7');
  const [promoBannerTextColor, setPromoBannerTextColor] = useState('#000000');
  const [promoBannerUseGradient, setPromoBannerUseGradient] = useState(true);
  const [savingPromoBanner, setSavingPromoBanner] = useState(false);
  
  // Estados para edição inline do texto do banner
  const [isEditingPromoText, setIsEditingPromoText] = useState(false);
  const [editingPromoText, setEditingPromoText] = useState('');

  // Aguardar AuthContext terminar de carregar
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!store && !storeLoading && user) {
      loadStoreByAdminUser(user.id);
      return;
    }

    if (store?.customizations?.logoUrl) {
      setLogoPreview(store.customizations.logoUrl);
    } else {
      setLogoPreview(null);
    }
    
    // Carregar valores do PromoBanner - usar exatamente os mesmos valores que o componente PromoBanner usa
    // Isso garante que o formulário mostre o valor que está sendo exibido no site
    if (store) {
      const customization = store.customizations;
      // Usar a mesma lógica do PromoBanner para determinar os valores
      // O PromoBanner usa: customization?.promoBannerText || 'ESQUENTA BLACK FRIDAY - ATÉ 60%OFF'
      // Então se promoBannerText for undefined/null, mostrar o padrão
      const textToShow = customization?.promoBannerText || 'ESQUENTA BLACK FRIDAY - ATÉ 60%OFF';
      const bgColorToShow = customization?.promoBannerBgColor || '#FDD8A7';
      const textColorToShow = customization?.promoBannerTextColor || '#000000';
      
      setPromoBannerVisible(customization?.promoBannerVisible ?? true);
      setPromoBannerText(textToShow);
      setPromoBannerBgColor(bgColorToShow);
      setPromoBannerTextColor(textColorToShow);
      setPromoBannerUseGradient(customization?.promoBannerUseGradient ?? true);
    }
  }, [store, store?.customizations]);

  // Centralizar imagem quando o editor abrir
  useEffect(() => {
    if (!isEditing || !imageToEdit || !imageSize.width || !imageSize.height) {
      // Se não há imagem, resetar cropData
      if (!isEditing) {
        setCropData({ x: 0, y: 0, width: 0, height: 0 });
      }
      return;
    }
    
    const container = containerRef.current;
    if (!container) {
      // Tentar novamente se o container não estiver disponível
      const retryTimeout = setTimeout(() => {
        if (containerRef.current) {
          // Forçar re-render
          setCropData(prev => ({ ...prev }));
        }
      }, 50);
      return () => clearTimeout(retryTimeout);
    }
    
    // Função para calcular e centralizar a imagem
    const calculateAndCenterImage = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      
      if (containerWidth === 0 || containerHeight === 0) {
        // Se o container ainda não tem dimensões, tentar novamente
        requestAnimationFrame(calculateAndCenterImage);
        return;
      }
      
      // Obter o overlay (área de crop 1920x840)
      const overlay = container.querySelector('.overlay') as HTMLElement;
      if (!overlay) {
        // Se o overlay ainda não existe, tentar novamente
        requestAnimationFrame(calculateAndCenterImage);
        return;
      }
      
      const overlayRect = overlay.getBoundingClientRect();
      const overlayWidth = overlayRect.width;
      const overlayHeight = overlayRect.height;
      
      if (overlayWidth === 0 || overlayHeight === 0) {
        requestAnimationFrame(calculateAndCenterImage);
        return;
      }
      
      // Calcular posição do overlay em relação ao container
      const overlayLeft = overlayRect.left - containerRect.left;
      const overlayTop = overlayRect.top - containerRect.top;
      
      // Calcular tamanho inicial para preencher completamente o overlay usando object-fit: cover
      const cropAspect = 1920 / 840; // 2.2857...
      const imgAspect = imageSize.width / imageSize.height;
      
      let initialWidth: number;
      let initialHeight: number;
      
      // Sempre preencher completamente o overlay usando object-fit: cover
      if (imgAspect > cropAspect) {
        // Imagem é mais larga - preencher altura do overlay e deixar largura maior
        initialHeight = overlayHeight;
        initialWidth = initialHeight * imgAspect;
      } else {
        // Imagem é mais alta - preencher largura do overlay e deixar altura maior
        initialWidth = overlayWidth;
        initialHeight = initialWidth / imgAspect;
      }
      
      // Garantir que a imagem preencha completamente o overlay (nunca menor)
      if (initialWidth < overlayWidth) {
        const scale = overlayWidth / initialWidth;
        initialWidth = overlayWidth;
        initialHeight = initialHeight * scale;
      }
      if (initialHeight < overlayHeight) {
        const scale = overlayHeight / initialHeight;
        initialHeight = overlayHeight;
        initialWidth = initialWidth * scale;
      }
      
      // SEMPRE centralizar a imagem dentro do overlay (área de crop)
      const centerX = overlayLeft + (overlayWidth - initialWidth) / 2;
      const centerY = overlayTop + (overlayHeight - initialHeight) / 2;
      
      console.log('Centralizando imagem:', {
        overlayWidth,
        overlayHeight,
        overlayLeft,
        overlayTop,
        initialWidth,
        initialHeight,
        centerX,
        centerY,
        imgAspect: imageSize.width / imageSize.height,
        cropAspect: 1920 / 840
      });
      
      // Atualizar o estado
      setCropData({ 
        x: Math.round(centerX), 
        y: Math.round(centerY), 
        width: Math.round(initialWidth), 
        height: Math.round(initialHeight) 
      });
      setScale(1);
    };
    
    // Aguardar múltiplos frames para garantir que o DOM esteja completamente renderizado
    let timeoutId: NodeJS.Timeout;
    let rafId: number;
    
    const scheduleCalculation = () => {
      // Primeiro, tentar calcular imediatamente
      calculateAndCenterImage();
      
      // Depois, agendar recálculo após um pequeno delay para garantir que está correto
      timeoutId = setTimeout(() => {
        rafId = requestAnimationFrame(() => {
          requestAnimationFrame(calculateAndCenterImage);
        });
      }, 200);
    };
    
    scheduleCalculation();
    
    // Também recalcular quando a janela for redimensionada
    const handleResize = () => {
      requestAnimationFrame(calculateAndCenterImage);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isEditing, imageToEdit, imageSize.width, imageSize.height]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // Função para redimensionar/recortar imagem para 1920x840
  const resizeAndCropImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const targetWidth = 1920;
      const targetHeight = 840;
      
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
          }

          // Calcular proporções para preencher o canvas mantendo aspecto
          const imgAspect = img.width / img.height;
          const targetAspect = targetWidth / targetHeight;

          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = img.width;
          let sourceHeight = img.height;

          // Se a imagem é mais larga que o alvo (aspect ratio maior)
          if (imgAspect > targetAspect) {
            // A imagem é mais larga, recortar nas laterais
            sourceHeight = img.height;
            sourceWidth = img.height * targetAspect;
            sourceX = (img.width - sourceWidth) / 2;
          } else {
            // A imagem é mais alta, recortar no topo/baixo
            sourceWidth = img.width;
            sourceHeight = img.width / targetAspect;
            sourceY = (img.height - sourceHeight) / 2;
          }

          // Desenhar imagem recortada e redimensionada no canvas
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, targetWidth, targetHeight
          );

          // Limpar URL do objeto
          URL.revokeObjectURL(objectUrl);

          // Converter canvas para blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Erro ao converter imagem'));
              }
            },
            'image/png',
            0.9 // Qualidade (0.9 = 90%)
          );
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Erro ao carregar imagem'));
      };

      img.src = objectUrl;
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setMessage('❌ Por favor, selecione um arquivo de imagem válido');
      return;
    }

    // A compressão será feita automaticamente se passar de 3MB
    // Permitir upload de até 10MB inicialmente (será comprimido se necessário)
    if (file.size > 10 * 1024 * 1024) {
      setMessage('❌ A imagem deve ter no máximo 10MB');
      return;
    }

    // Resetar estados antes de abrir o editor
    setCropData({ x: 0, y: 0, width: 0, height: 0 });
    setScale(1);
    setImageSize({ width: 0, height: 0 });
    
    // Abrir modo de edição
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
        setImageToEdit(reader.result as string);
        setIsEditing(true);
        setScale(1);
        // O cropData será calculado pelo useEffect quando o editor abrir
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Calcular distância entre dois pontos de toque
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calcular escala mínima para garantir que a imagem sempre preencha a área de crop
  const getMinScale = (): number => {
    const container = containerRef.current;
    if (!container || cropData.width === 0 || cropData.height === 0) {
      return 1;
    }

    const overlay = container.querySelector('.overlay') as HTMLElement;
    if (!overlay) return 1;

    const containerRect = container.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    
    // Calcular dimensões do overlay em relação ao container
    const overlayWidth = overlayRect.width;
    const overlayHeight = overlayRect.height;

    if (overlayWidth === 0 || overlayHeight === 0) return 1;

    // A escala mínima é quando a imagem (escalada) preenche completamente o overlay
    // Precisamos garantir que tanto a largura quanto a altura escaladas sejam >= ao overlay
    const minScaleX = overlayWidth / cropData.width;
    const minScaleY = overlayHeight / cropData.height;
    
    // Usar o maior para garantir que a imagem sempre preencha completamente
    return Math.max(minScaleX, minScaleY);
  };

  // Função para limitar a posição da imagem para sempre preencher o overlay
  const constrainImagePosition = (x: number, y: number): { x: number; y: number } => {
    const container = containerRef.current;
    if (!container) return { x, y };

    const overlay = container.querySelector('.overlay') as HTMLElement;
    if (!overlay) return { x, y };

    const containerRect = container.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    
    // Calcular posição do overlay em relação ao container
    const overlayLeft = overlayRect.left - containerRect.left;
    const overlayTop = overlayRect.top - containerRect.top;
    const overlayRight = overlayLeft + overlayRect.width;
    const overlayBottom = overlayTop + overlayRect.height;

    // Calcular dimensões da imagem escalada
    const imageWidth = cropData.width * scale;
    const imageHeight = cropData.height * scale;

    // Calcular bordas da imagem na posição atual
    const imageLeft = x;
    const imageTop = y;
    const imageRight = x + imageWidth;
    const imageBottom = y + imageHeight;

    // Limitar posição para garantir que a imagem sempre preencha o overlay
    // A imagem não pode ser movida para uma posição onde deixe fundo branco visível
    
    // Limite horizontal: a imagem deve sempre cobrir o overlay horizontalmente
    // A borda esquerda da imagem não pode estar à direita da borda esquerda do overlay
    // A borda direita da imagem não pode estar à esquerda da borda direita do overlay
    let constrainedX = x;
    if (imageLeft > overlayLeft) {
      // Se a borda esquerda está à direita do overlay, mover para alinhar
      constrainedX = overlayLeft;
    } else if (imageRight < overlayRight) {
      // Se a borda direita está à esquerda do overlay, mover para alinhar
      constrainedX = overlayRight - imageWidth;
    }

    // Limite vertical: a imagem deve sempre cobrir o overlay verticalmente
    // A borda superior da imagem não pode estar abaixo da borda superior do overlay (imageTop <= overlayTop)
    // A borda inferior da imagem não pode estar acima da borda inferior do overlay (imageBottom >= overlayBottom)
    
    // Calcular os limites para Y
    // minY: posição onde a borda superior da imagem está alinhada com a borda superior do overlay
    const minY = overlayTop;
    // maxY: posição onde a borda inferior da imagem está alinhada com a borda inferior do overlay
    const maxY = overlayBottom - imageHeight;
    
    // Como a imagem sempre tem altura suficiente (devido à escala mínima),
    // maxY <= minY, então Y deve estar entre maxY e minY
    let constrainedY = y;
    
    // Aplicar os limites: Y deve estar entre maxY e minY
    if (constrainedY < maxY) {
      constrainedY = maxY;
    } else if (constrainedY > minY) {
      constrainedY = minY;
    }

    // Recalcular bordas da imagem com a posição limitada
    const finalImageLeft = constrainedX;
    const finalImageTop = constrainedY;
    const finalImageRight = constrainedX + imageWidth;
    const finalImageBottom = constrainedY + imageHeight;

    // Snap opcional: alinhar bordas quando próximas (para facilitar o alinhamento perfeito)
    const snapThreshold = 10; // pixels de tolerância para snap
    let snappedX = constrainedX;
    let snappedY = constrainedY;

    // Calcular centro do overlay e centro da imagem
    const overlayCenterX = overlayLeft + overlayRect.width / 2;
    const overlayCenterY = overlayTop + overlayRect.height / 2;
    const imageCenterX = finalImageLeft + imageWidth / 2;
    const imageCenterY = finalImageTop + imageHeight / 2;

    // Snap horizontal: verificar bordas primeiro, depois centro
    if (Math.abs(finalImageLeft - overlayLeft) < snapThreshold) {
      snappedX = overlayLeft;
    } else if (Math.abs(finalImageRight - overlayRight) < snapThreshold) {
      snappedX = overlayRight - imageWidth;
    } else if (Math.abs(imageCenterX - overlayCenterX) < snapThreshold) {
      // Snap ao centro horizontal
      snappedX = overlayCenterX - imageWidth / 2;
    } else {
      snappedX = constrainedX;
    }

    // Snap vertical: verificar bordas primeiro, depois centro
    if (Math.abs(finalImageTop - overlayTop) < snapThreshold) {
      snappedY = overlayTop;
    } else if (Math.abs(finalImageBottom - overlayBottom) < snapThreshold) {
      snappedY = overlayBottom - imageHeight;
    } else if (Math.abs(imageCenterY - overlayCenterY) < snapThreshold) {
      // Snap ao centro vertical
      snappedY = overlayCenterY - imageHeight / 2;
    } else {
      snappedY = constrainedY;
    }

    return { x: snappedX, y: snappedY };
  };

  // Handlers para mover imagem
  const handleImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      containerX: cropData.x,
      containerY: cropData.y
    };
    
    document.addEventListener('mousemove', handleImageMouseMove);
    document.addEventListener('mouseup', handleImageMouseUp);
  };

  const handleImageMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    // Calcular nova posição
    const newX = dragStartRef.current.containerX + deltaX;
    const newY = dragStartRef.current.containerY + deltaY;
    
    // Limitar posição para garantir que a imagem sempre preencha o overlay
    const constrained = constrainImagePosition(newX, newY);
    
    setCropData(prev => ({
      ...prev,
      x: constrained.x,
      y: constrained.y
    }));
  };

  const handleImageMouseUp = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleImageMouseMove);
    document.removeEventListener('mouseup', handleImageMouseUp);
  };

  // Handler para zoom com scroll do mouse
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const minScale = getMinScale();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const oldScale = scale;
    const newScale = Math.max(minScale, Math.min(3, scale + delta));
    
    if (oldScale === newScale) return;
    
    // Calcular o centro atual da imagem
    const currentCenterX = cropData.x + (cropData.width * oldScale) / 2;
    const currentCenterY = cropData.y + (cropData.height * oldScale) / 2;
    
    // Calcular nova posição para manter o centro fixo
    const newWidth = cropData.width * newScale;
    const newHeight = cropData.height * newScale;
    const newX = currentCenterX - newWidth / 2;
    const newY = currentCenterY - newHeight / 2;
    
    setCropData(prev => ({
      ...prev,
      x: newX,
      y: newY
    }));
    setScale(newScale);
  };

  // Handlers para gestos de pinça (touch)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Iniciar gesto de pinça
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      pinchStartRef.current = { distance, scale };
      lastTouchDistanceRef.current = distance;
    } else if (e.touches.length === 1) {
      // Iniciar arrasto
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        containerX: cropData.x,
        containerY: cropData.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      // Gesto de pinça - zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      if (lastTouchDistanceRef.current !== null) {
        const scaleChange = distance / lastTouchDistanceRef.current;
        const oldScale = pinchStartRef.current.scale;
        const minScale = getMinScale();
        const newScale = Math.max(minScale, Math.min(3, oldScale * scaleChange));
        
        if (oldScale !== newScale) {
          // Calcular o centro atual da imagem
          const currentCenterX = cropData.x + (cropData.width * oldScale) / 2;
          const currentCenterY = cropData.y + (cropData.height * oldScale) / 2;
          
          // Calcular nova posição para manter o centro fixo
          const newWidth = cropData.width * newScale;
          const newHeight = cropData.height * newScale;
          const newX = currentCenterX - newWidth / 2;
          const newY = currentCenterY - newHeight / 2;
          
          setCropData(prev => ({
            ...prev,
            x: newX,
            y: newY
          }));
        }
        
        setScale(newScale);
        pinchStartRef.current.scale = newScale;
      }
      lastTouchDistanceRef.current = distance;
    } else if (e.touches.length === 1 && isDraggingRef.current) {
      // Arrasto com um dedo
      e.preventDefault();
      const deltaX = e.touches[0].clientX - dragStartRef.current.x;
      const deltaY = e.touches[0].clientY - dragStartRef.current.y;
      
      // Calcular nova posição
      const newX = dragStartRef.current.containerX + deltaX;
      const newY = dragStartRef.current.containerY + deltaY;
      
      // Limitar posição para garantir que a imagem sempre preencha o overlay
      const constrained = constrainImagePosition(newX, newY);
      
      setCropData(prev => ({
        ...prev,
        x: constrained.x,
        y: constrained.y
      }));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    pinchStartRef.current = null;
    lastTouchDistanceRef.current = null;
  };

  // Função para aplicar crop
  const applyCrop = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const targetWidth = 1920;
      const targetHeight = 840;
      
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
          }

          // Obter container e overlay para calcular posição do overlay
          const container = containerRef.current;
          if (!container) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Container não encontrado'));
            return;
          }

          const overlay = container.querySelector('.overlay') as HTMLElement;
          if (!overlay) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Overlay não encontrado'));
            return;
          }

          const containerRect = container.getBoundingClientRect();
          const overlayRect = overlay.getBoundingClientRect();
          
          // Calcular posição do overlay em relação ao container
          const overlayLeft = overlayRect.left - containerRect.left;
          const overlayTop = overlayRect.top - containerRect.top;
          const overlayWidth = overlayRect.width;
          const overlayHeight = overlayRect.height;
          
          // Calcular posição da imagem em relação ao container
          // cropData.x e cropData.y já estão em relação ao container
          const imageLeft = cropData.x;
          const imageTop = cropData.y;
          const displayedWidth = cropData.width * scale;
          const displayedHeight = cropData.height * scale;
          
          // Calcular offset do overlay em relação à imagem
          const left = overlayLeft - imageLeft;
          const top = overlayTop - imageTop;
          
          // Calcular escala da imagem exibida vs original
          const scaleX = img.width / displayedWidth;
          const scaleY = img.height / displayedHeight;
          
          // Converter coordenadas para imagem original
          // Se left/top são negativos, significa que o overlay está fora da imagem
          const sourceX = Math.max(0, left) * scaleX;
          const sourceY = Math.max(0, top) * scaleY;
          const sourceWidth = Math.min(overlayWidth * scaleX, img.width - sourceX);
          const sourceHeight = Math.min(overlayHeight * scaleY, img.height - sourceY);

          // Desenhar imagem recortada e redimensionada no canvas
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, targetWidth, targetHeight
          );

          // Limpar URL do objeto
          URL.revokeObjectURL(objectUrl);

          // Converter canvas para blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Erro ao converter imagem'));
              }
            },
            'image/png',
            0.9 // Qualidade (0.9 = 90%)
          );
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Erro ao carregar imagem'));
      };

      img.src = objectUrl;
    });
  };

  const handleConfirmCrop = async () => {
    if (!selectedImageFile || !store?.id) return;

    setUploadingLogo(true);
    setMessage('⏳ Processando imagem...');

    try {
      // Comprimir imagem original se necessário (antes do crop)
      const compressedFile = await compressImageIfNeeded(selectedImageFile, 3);
      
      // Aplicar crop ANTES de fechar o modal (para ter acesso aos elementos DOM)
      const processedBlob = await applyCrop(compressedFile);
      
      // Comprimir o blob processado se necessário (pode ter ficado grande após o crop)
      const finalBlob = await compressBlobIfNeeded(processedBlob, 3);
      
      // Fechar o modal após processar
      setIsEditing(false);
      
      // Criar nome único para o arquivo
      const fileExt = 'png'; // Sempre salvar como PNG após processamento
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${store.id}/${fileName}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, finalBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png'
        });

      if (uploadError) {
        throw uploadError;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath);

      // Atualizar customizações no banco
      const { data: existingCustomization } = await supabase
        .from('store_customizations')
        .select('id, logo_url')
        .eq('store_id', store.id)
        .maybeSingle();

      // Se existe um logo antigo, deletar do Storage antes de atualizar
      if (existingCustomization?.logo_url && existingCustomization.logo_url !== publicUrl) {
        await deleteImageFromStorage(existingCustomization.logo_url);
      }

      if (existingCustomization) {
        // Atualizar existente
        const { error: updateError } = await supabase
          .from('store_customizations')
          .update({
            logo_url: publicUrl,
            logo_alt_text: store.name || 'Logo',
            updated_at: new Date().toISOString()
          })
          .eq('store_id', store.id);

        if (updateError) throw updateError;
      } else {
        // Criar novo
        const { error: insertError } = await supabase
          .from('store_customizations')
          .insert({
            store_id: store.id,
            logo_url: publicUrl,
            logo_alt_text: store.name || 'Logo'
          });

        if (insertError) throw insertError;
      }

      setLogoPreview(publicUrl);
      setMessage('✅ Logo atualizado com sucesso!');
      
      // Recarregar customizações
      await reloadCustomizations();
    } catch (error: any) {
      console.error('Erro ao fazer upload do logo:', error);
      setMessage(`❌ Erro ao fazer upload: ${error.message}`);
    } finally {
      setUploadingLogo(false);
    }
  };


  const handleCancelEdit = () => {
    // Limpar event listeners
    document.removeEventListener('mousemove', handleImageMouseMove);
    document.removeEventListener('mouseup', handleImageMouseUp);
    
    setIsEditing(false);
    setSelectedImageFile(null);
    setImageToEdit(null);
    setCropData({ x: 0, y: 0, width: 450, height: 450 });
    setScale(1);
    isDraggingRef.current = false;
    pinchStartRef.current = null;
    lastTouchDistanceRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!store?.id) return;

    if (!confirm('Tem certeza que deseja remover o logo? Isso fará com que o logo padrão seja exibido.')) {
      return;
    }

    try {
      // Buscar customização atual para obter o logo_url
      const { data: existingCustomization, error: fetchError } = await supabase
        .from('store_customizations')
        .select('id, logo_url')
        .eq('store_id', store.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // Se existe customização e tem logo_url, deletar o arquivo do Storage
      if (existingCustomization?.logo_url) {
        await deleteImageFromStorage(existingCustomization.logo_url);
      }

      // Atualizar banco de dados para remover a referência
      if (existingCustomization) {
        const { error: updateError } = await supabase
          .from('store_customizations')
          .update({
            logo_url: null,
            updated_at: new Date().toISOString()
          })
          .eq('store_id', store.id);

        if (updateError) throw updateError;
      }

      // Limpar preview imediatamente
      setLogoPreview(null);
      setMessage('✅ Logo removido com sucesso!');
      
      // Recarregar customizações
      await reloadCustomizations();
    } catch (error: any) {
      console.error('Erro ao remover logo:', error);
      setMessage(`❌ Erro ao remover logo: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleSavePromoBanner = async () => {
    if (!store?.id) return;

    setSavingPromoBanner(true);
    setMessage('⏳ Salvando personalização do banner...');

    try {
      // Buscar customização existente
      const { data: existingCustomization } = await supabase
        .from('store_customizations')
        .select('id')
        .eq('store_id', store.id)
        .maybeSingle();

      const updateData = {
        promo_banner_visible: promoBannerVisible,
        promo_banner_text: promoBannerText,
        promo_banner_bg_color: promoBannerBgColor,
        promo_banner_text_color: promoBannerTextColor,
        promo_banner_use_gradient: promoBannerUseGradient,
        updated_at: new Date().toISOString()
      };

      if (existingCustomization) {
        // Atualizar existente
        const { error: updateError } = await supabase
          .from('store_customizations')
          .update(updateData)
          .eq('store_id', store.id);

        if (updateError) throw updateError;
      } else {
        // Criar novo
        const { error: insertError } = await supabase
          .from('store_customizations')
          .insert({
            store_id: store.id,
            ...updateData
          });

        if (insertError) throw insertError;
      }

      setMessage('✅ Personalização do banner salva com sucesso!');
      
      // Recarregar customizações
      await reloadCustomizations();
    } catch (error: any) {
      console.error('Erro ao salvar personalização do banner:', error);
      setMessage(`❌ Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSavingPromoBanner(false);
    }
  };

  // Funções para edição inline do texto do banner
  const handlePromoTextDoubleClick = () => {
    setIsEditingPromoText(true);
    setEditingPromoText(promoBannerText);
  };

  const handlePromoTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingPromoText(e.target.value);
  };

  const handlePromoTextSave = async () => {
    if (!editingPromoText.trim()) {
      setIsEditingPromoText(false);
      return;
    }

    const newText = editingPromoText.trim();
    
    // Se o texto não mudou, apenas cancelar a edição
    if (newText === promoBannerText) {
      setIsEditingPromoText(false);
      setEditingPromoText('');
      return;
    }

    // Atualizar o estado local
    setPromoBannerText(newText);
    setIsEditingPromoText(false);
    setEditingPromoText('');

    // Salvar automaticamente no banco
    if (!store?.id) return;

    try {
      const { data: existingCustomization } = await supabase
        .from('store_customizations')
        .select('id')
        .eq('store_id', store.id)
        .maybeSingle();

      const updateData = {
        promo_banner_text: newText,
        updated_at: new Date().toISOString()
      };

      if (existingCustomization) {
        const { error: updateError } = await supabase
          .from('store_customizations')
          .update(updateData)
          .eq('store_id', store.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('store_customizations')
          .insert({
            store_id: store.id,
            promo_banner_visible: promoBannerVisible,
            promo_banner_bg_color: promoBannerBgColor,
            promo_banner_text_color: promoBannerTextColor,
            promo_banner_use_gradient: promoBannerUseGradient,
            ...updateData
          });

        if (insertError) throw insertError;
      }

      // Recarregar customizações
      await reloadCustomizations();
      setMessage('✅ Texto do banner atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar texto do banner:', error);
      setMessage(`❌ Erro ao salvar texto: ${error.message || 'Erro desconhecido'}`);
      // Reverter o estado em caso de erro
      setPromoBannerText(promoBannerText);
    }
  };

  const handlePromoTextCancel = () => {
    setIsEditingPromoText(false);
    setEditingPromoText('');
  };

  const handlePromoTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePromoTextSave();
    } else if (e.key === 'Escape') {
      handlePromoTextCancel();
    }
  };

  if (authLoading || storeLoading) {
    return (
      <AdminLayout>
        <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>
          Carregando...
        </div>
      </AdminLayout>
    );
  }

  if (!store) {
    return (
      <AdminLayout>
        <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>
          Não foi possível carregar a loja.
        </div>
      </AdminLayout>
    );
  }


  return (
    <AdminLayout>
      {/* Modal de Edição de Imagem */}
      {isEditing && imageToEdit && (
        <div className="editor-modal-overlay" onClick={handleCancelEdit} style={{ zIndex: 10000 }}>
          <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
            <button className="editor-close-btn" onClick={handleCancelEdit} aria-label="Fechar">
              ×
            </button>
            
            <div className="editor-content">
              <h2>Editar Imagem</h2>
              <p className="editor-subtitle">Ajuste a posição e o tamanho da imagem para o formato 1920x840</p>
              
               <div className="editor-wrapper">
                 <div 
                   className="resize-container" 
                   ref={containerRef}
                   onWheel={handleWheel}
                   onTouchStart={handleTouchStart}
                   onTouchMove={handleTouchMove}
                   onTouchEnd={handleTouchEnd}
                 >
                   {cropData.width > 0 && cropData.height > 0 && (
                     <img
                       ref={imageRef}
                       src={imageToEdit}
                       alt="Imagem para editar"
                       className="resize-image"
                       style={{
                         position: 'absolute',
                         left: `${cropData.x}px`,
                         top: `${cropData.y}px`,
                         width: `${cropData.width * scale}px`,
                         height: `${cropData.height * scale}px`,
                         cursor: isDraggingRef.current ? 'grabbing' : 'move',
                         userSelect: 'none',
                         objectFit: 'cover',
                         touchAction: 'none'
                       }}
                       onMouseDown={handleImageMouseDown}
                       draggable={false}
                     />
                   )}
                   <div className="overlay"></div>
                 </div>
               </div>

              <div className="editor-actions">
                <button className="editor-btn editor-btn-cancel" onClick={handleCancelEdit}>
                  Cancelar
                </button>
                <button 
                  className="editor-btn editor-btn-crop js-crop" 
                  onClick={handleConfirmCrop}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? 'Processando...' : 'Aplicar Crop'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="personalization-page">
        <h1>Personalização</h1>
        <p className="subtitle">Personalize a aparência da sua loja</p>

        {message && (
          <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <div className="form-container">
          <h2>Imagem do Banner</h2>
          <p className="form-description">
            Escolha a imagem que aparecerá no topo do seu cardápio.
          </p>

          <div className="form-group">
            <div
              className="image-upload-area"
              onClick={handleImageClick}
              style={{
                width: '100%',
                aspectRatio: '1920/840',
                border: '2px dashed #ddd',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backgroundColor: '#f9f9f9',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                disabled={uploadingLogo}
              />
              
              {uploadingLogo ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏳</div>
                  <p>Enviando imagem...</p>
                </div>
              ) : logoPreview ? (
                <>
                  <img
                    src={logoPreview}
                    alt="Preview do logo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      position: 'absolute',
                      top: 0,
                      left: 0
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLogo();
                    }}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      padding: '8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      zIndex: 10
                    }}
                    title="Remover logo"
                  >
                    <img
                      src={trashIcon}
                      alt="Remover"
                      style={{
                        width: '20px',
                        height: '20px',
                        filter: 'brightness(0) invert(1)'
                      }}
                    />
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={addImageIcon}
                    alt="Adicionar imagem"
                    style={{ width: '64px', height: '64px', marginBottom: '16px', opacity: 0.5 }}
                  />
                  <p style={{ color: '#666', fontSize: '16px', margin: 0 }}>
                    Clique para adicionar imagem do logo
                  </p>
                  <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
                    PNG, JPG ou SVG (máx. 5MB)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Seção de Personalização da Barra Promocional */}
        <div className="form-container">
          <h2>Barra Promocional</h2>
          <p className="form-description">
            Personalize a barra promocional que aparece no topo do cardápio.
          </p>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input
                type="checkbox"
                checked={promoBannerVisible}
                onChange={(e) => setPromoBannerVisible(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Exibir barra promocional</span>
            </label>
          </div>

          {promoBannerVisible && (
            <>
              {/* Banner Editável - substitui o campo de input */}
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Texto do Banner (clique duas vezes para editar)
                </label>
                {/* Quadrado clicável para selecionar a cor de fundo */}
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                    Cor da Barra Promocional:
                  </span>
                  <label
                    htmlFor="promoBannerBgColorPicker"
                    style={{
                      width: '30px',
                      height: '30px',
                      backgroundColor: promoBannerBgColor,
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      cursor: 'pointer',
                      display: 'block',
                      position: 'relative',
                      flexShrink: 0
                    }}
                    title={`Clique para alterar a cor de fundo (${promoBannerBgColor})`}
                  >
                    <input
                      id="promoBannerBgColorPicker"
                      type="color"
                      value={promoBannerBgColor}
                      onChange={(e) => setPromoBannerBgColor(e.target.value)}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        border: 'none',
                        padding: 0,
                        margin: 0
                      }}
                    />
                  </label>
                </div>
                <div
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#fff'
                  }}
                >
                  <section
                    className="promo-banner"
                    style={{
                      backgroundColor: promoBannerBgColor,
                      padding: '15px 16px',
                      textAlign: 'center',
                      width: '100%',
                      minWidth: '400px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      minHeight: 'calc(16px * 1.4 + 30px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box'
                    }}
                  >
                    {isEditingPromoText ? (
                      <input
                        type="text"
                        value={editingPromoText}
                        onChange={handlePromoTextChange}
                        onBlur={handlePromoTextSave}
                        onKeyDown={handlePromoTextKeyDown}
                        autoFocus
                        style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          margin: 0,
                          border: '2px solid #007bff',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          width: '100%',
                          maxWidth: '100%',
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          textAlign: 'center',
                          fontFamily: 'inherit'
                        }}
                      />
                    ) : (
                      <p
                        className={`promo-text ${promoBannerUseGradient ? 'with-gradient' : ''}`}
                        onDoubleClick={handlePromoTextDoubleClick}
                        style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          margin: 0,
                          cursor: 'pointer',
                          ...(!promoBannerUseGradient ? { color: promoBannerTextColor } : {})
                        }}
                        title="Clique duas vezes para editar"
                      >
                        {promoBannerText || 'ESQUENTA BLACK FRIDAY - ATÉ 60%OFF'}
                      </p>
                    )}
                  </section>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="promoBannerTextColor" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Cor do Texto
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    id="promoBannerTextColor"
                    type="color"
                    value={promoBannerTextColor}
                    onChange={(e) => setPromoBannerTextColor(e.target.value)}
                    disabled={promoBannerUseGradient}
                    style={{
                      width: '60px',
                      height: '40px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: promoBannerUseGradient ? 'not-allowed' : 'pointer',
                      opacity: promoBannerUseGradient ? 0.5 : 1
                    }}
                  />
                  <input
                    type="text"
                    value={promoBannerTextColor}
                    onChange={(e) => setPromoBannerTextColor(e.target.value)}
                    placeholder="#000000"
                    disabled={promoBannerUseGradient}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontFamily: 'monospace',
                      opacity: promoBannerUseGradient ? 0.5 : 1,
                      cursor: promoBannerUseGradient ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <input
                    type="checkbox"
                    checked={promoBannerUseGradient}
                    onChange={(e) => setPromoBannerUseGradient(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>Usar gradiente animado no texto</span>
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginLeft: '26px' }}>
                  Quando ativado, o texto terá um efeito de gradiente animado. A cor do texto será ignorada.
                </p>
              </div>

              <div className="form-group" style={{ marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={handleSavePromoBanner}
                  disabled={savingPromoBanner}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: savingPromoBanner ? 'not-allowed' : 'pointer',
                    opacity: savingPromoBanner ? 0.6 : 1
                  }}
                >
                  {savingPromoBanner ? 'Salvando...' : 'Salvar Personalização do Banner'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

