import { productImages } from '../data/products';

/**
 * Obtém a URL da imagem do produto
 * Se a imagem for uma URL (começa com http:// ou https://), usa diretamente
 * Caso contrário, tenta buscar no mapeamento local de imagens
 * 
 * @param image - URL da imagem ou chave do mapeamento local
 * @returns URL da imagem a ser usada
 */
export function getProductImage(image: string | undefined | null): string {
  if (!image) {
    return productImages.product1; // Fallback padrão
  }
  
  // Se for uma URL válida (http:// ou https://), usar diretamente
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:')) {
    return image;
  }
  
  // Caso contrário, tentar buscar no mapeamento local
  return productImages[image] || productImages.product1;
}

