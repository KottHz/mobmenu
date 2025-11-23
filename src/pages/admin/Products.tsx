import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { createProduct, updateProduct, deleteProduct, clearProductsCache } from '../../services/productService';
import AdminLayout from '../../components/admin/AdminLayout';
import './Products.css';

interface Set {
  id: string;
  name: string;
}

interface Subset {
  id: string;
  name: string;
  set_id: string;
}

export default function AdminProducts() {
  const { store, loading: storeLoading, loadStoreByAdminUser } = useStore();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [subsets, setSubsets] = useState<Subset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    image: '',
    title: '',
    description1: '',
    description2: '',
    oldPrice: '',
    newPrice: '',
    fullDescription: '',
    setId: '',
    subsetId: '',
    displayOrder: 0,
    isActive: true,
  });
  const [message, setMessage] = useState('');

  // Aguardar AuthContext terminar de carregar
  useEffect(() => {
    if (authLoading) {
      console.log('⏳ [Products] Aguardando AuthContext terminar de carregar...');
      return;
    }

    // Se não há store mas há usuário autenticado, tentar carregar a loja
    if (!store && !storeLoading && user) {
      console.log('🔍 [Products] Store não carregado, mas usuário autenticado. Tentando carregar loja...');
      loadStoreByAdminUser(user.id);
      return;
    }

    // Se há store, carregar produtos
    if (store?.id) {
      console.log('✅ [Products] Store carregado, iniciando carregamento de produtos');
      loadProducts();
      loadSets();
    } else if (!storeLoading) {
      console.warn('⚠️ [Products] Store não disponível e não está carregando');
      setLoading(false);
    }
  }, [store?.id, storeLoading, user, authLoading, loadStoreByAdminUser]);

  useEffect(() => {
    if (formData.setId) {
      loadSubsets(formData.setId);
    } else {
      setSubsets([]);
    }
  }, [formData.setId]);

  const loadProducts = async () => {
    if (!store?.id) {
      console.warn('⚠️ [Products] Store ID não disponível ainda');
      setLoading(false);
      return;
    }

    console.log('🔍 [Products] Carregando produtos para loja:', store.id);
    setLoading(true);
    setMessage('');
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', store.id)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('❌ [Products] Erro na query:', error);
        console.error('❌ [Products] Código:', error.code);
        console.error('❌ [Products] Mensagem:', error.message);
        console.error('❌ [Products] Detalhes:', error.details);
        console.error('❌ [Products] Hint:', error.hint);
        
        // Verificar se é erro de tabela não encontrada
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setMessage('❌ Tabela de produtos não encontrada. Execute o script SQL para criar a tabela products no Supabase.');
        } else if (error.code === '42501' || error.message?.includes('permission denied')) {
          setMessage('❌ Erro de permissão. Verifique as políticas RLS da tabela products.');
        } else {
          setMessage(`❌ Erro ao carregar produtos: ${error.message}`);
        }
        setProducts([]);
        return;
      }

      console.log('✅ [Products] Produtos carregados:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('🖼️ [Products] Primeiro produto - URL da imagem:', data[0].image);
      }
      setProducts(data || []);
      
      if (!data || data.length === 0) {
        console.log('ℹ️ [Products] Nenhum produto encontrado para esta loja');
      }
    } catch (error: any) {
      console.error('❌ [Products] Erro ao carregar produtos:', error);
      console.error('❌ [Products] Tipo:', error?.constructor?.name);
      setMessage(`❌ Erro ao carregar produtos: ${error.message || 'Erro desconhecido'}`);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSets = async () => {
    if (!store?.id) return;

    try {
      const { data, error } = await supabase
        .from('sets')
        .select('id, name')
        .eq('store_id', store.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setSets(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar seções:', error);
    }
  };

  const loadSubsets = async (setId: string) => {
    if (!store?.id) return;

    try {
      const { data, error } = await supabase
        .from('subsets')
        .select('id, name, set_id')
        .eq('store_id', store.id)
        .eq('set_id', setId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setSubsets(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar subseções:', error);
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setFormData({
      image: '',
      title: '',
      description1: '',
      description2: '',
      oldPrice: '',
      newPrice: '',
      fullDescription: '',
      setId: '',
      subsetId: '',
      displayOrder: 0,
      isActive: true,
    });
    setShowAddForm(true);
    setMessage('');
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      image: product.image || '',
      title: product.title || '',
      description1: product.description1 || '',
      description2: product.description2 || '',
      oldPrice: product.old_price || '',
      newPrice: product.new_price || '',
      fullDescription: product.full_description || '',
      setId: product.set_id || '',
      subsetId: product.subset_id || '',
      displayOrder: product.display_order || 0,
      isActive: product.is_active ?? true,
    });
    setShowAddForm(true);
    setMessage('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      const success = await deleteProduct(id);
      if (!success) throw new Error('Erro ao excluir produto');

      setMessage('✅ Produto excluído com sucesso!');
      clearProductsCache();
      loadProducts();
    } catch (error: any) {
      console.error('Erro ao excluir produto:', error);
      setMessage(`❌ Erro ao excluir produto: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;

    setMessage('');

    try {
      if (editingProduct) {
        // Atualizar produto existente
        const updated = await updateProduct({
          id: editingProduct.id,
          image: formData.image,
          title: formData.title,
          description1: formData.description1,
          description2: formData.description2,
          oldPrice: formData.oldPrice,
          newPrice: formData.newPrice,
          fullDescription: formData.fullDescription,
          setId: formData.setId || undefined,
          subsetId: formData.subsetId || undefined,
          displayOrder: formData.displayOrder,
          isActive: formData.isActive,
        });

        if (!updated) throw new Error('Erro ao atualizar produto');

        setMessage('✅ Produto atualizado com sucesso!');
      } else {
        // Criar novo produto
        console.log('📝 [Products] Tentando criar produto...');
        console.log('📝 [Products] Dados do formulário:', formData);
        console.log('📝 [Products] Store ID:', store.id);
        
        const created = await createProduct({
          image: formData.image,
          title: formData.title,
          description1: formData.description1,
          description2: formData.description2,
          oldPrice: formData.oldPrice,
          newPrice: formData.newPrice,
          fullDescription: formData.fullDescription,
          setId: formData.setId || undefined,
          subsetId: formData.subsetId || undefined,
          displayOrder: formData.displayOrder,
          isActive: formData.isActive,
          storeId: store.id, // Incluir storeId
        });

        if (!created) {
          console.error('❌ [Products] createProduct retornou null');
          throw new Error('Erro ao criar produto. Verifique o console para mais detalhes.');
        }

        console.log('✅ [Products] Produto criado com sucesso:', created.id);
        setMessage('✅ Produto criado com sucesso!');
      }

      clearProductsCache();
      setShowAddForm(false);
      setEditingProduct(null);
      await loadProducts();
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      setMessage(`❌ Erro ao salvar produto: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingProduct(null);
    setFormData({
      image: '',
      title: '',
      description1: '',
      description2: '',
      oldPrice: '',
      newPrice: '',
      fullDescription: '',
      setId: '',
      subsetId: '',
      displayOrder: 0,
      isActive: true,
    });
    setMessage('');
  };

  if (loading || authLoading || storeLoading || !store) {
    return (
      <AdminLayout>
        <div className="loading">
          {authLoading ? (
            <>
              <div>Carregando informações do usuário...</div>
              <div style={{ fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
                Aguardando autenticação
              </div>
            </>
          ) : !store ? (
            <>
              <div>Carregando informações da loja...</div>
              <div style={{ fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
                {user ? 'Buscando loja do administrador...' : 'Aguardando dados da loja'}
              </div>
            </>
          ) : (
            <>
              <div>Carregando produtos...</div>
              <div style={{ fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
                Buscando produtos da loja: {store.name}
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    );
  }

  if (products.length === 0 && !showAddForm) {
    return (
      <AdminLayout>
        <div className="products-admin-page">
          {message && (
            <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
          <div className="empty-state">
            <div className="empty-icon">🛍️</div>
            <h3>Nenhum produto cadastrado</h3>
            <p>Comece adicionando seu primeiro produto à loja</p>
            <button className="add-button" onClick={handleAdd}>
              ➕ Adicionar Primeiro Produto
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="products-admin-page">
        <h1>Gerenciamento de Produtos</h1>
        <p className="subtitle">Adicione, edite e organize os produtos da sua loja</p>

        {message && (
          <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {!showAddForm && (
          <div className="actions-bar">
            <button className="add-button" onClick={handleAdd}>
              ➕ Adicionar Produto
            </button>
          </div>
        )}

        {showAddForm && (
          <div className="form-container">
            <h2>{editingProduct ? 'Editar Produto' : 'Adicionar Produto'}</h2>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-group">
                <label>URL da Imagem *</label>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://exemplo.com/imagem.jpg"
                  required
                />
              </div>

              <div className="form-group">
                <label>Título do Produto *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nome do produto"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Descrição 1</label>
                  <input
                    type="text"
                    value={formData.description1}
                    onChange={(e) => setFormData({ ...formData, description1: e.target.value })}
                    placeholder="Primeira linha de descrição"
                  />
                </div>

                <div className="form-group">
                  <label>Descrição 2</label>
                  <input
                    type="text"
                    value={formData.description2}
                    onChange={(e) => setFormData({ ...formData, description2: e.target.value })}
                    placeholder="Segunda linha de descrição"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Preço Anterior (para desconto)</label>
                  <input
                    type="text"
                    value={formData.oldPrice}
                    onChange={(e) => setFormData({ ...formData, oldPrice: e.target.value })}
                    placeholder="R$ 0,00"
                  />
                </div>

                <div className="form-group">
                  <label>Preço Atual *</label>
                  <input
                    type="text"
                    value={formData.newPrice}
                    onChange={(e) => setFormData({ ...formData, newPrice: e.target.value })}
                    placeholder="R$ 0,00"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descrição Completa</label>
                <textarea
                  value={formData.fullDescription}
                  onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                  placeholder="Descrição detalhada do produto"
                  rows={4}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Seção</label>
                  <select
                    value={formData.setId}
                    onChange={(e) => setFormData({ ...formData, setId: e.target.value, subsetId: '' })}
                  >
                    <option value="">Nenhuma seção</option>
                    {sets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Subseção</label>
                  <select
                    value={formData.subsetId}
                    onChange={(e) => setFormData({ ...formData, subsetId: e.target.value })}
                    disabled={!formData.setId}
                  >
                    <option value="">Nenhuma subseção</option>
                    {subsets.map((subset) => (
                      <option key={subset.id} value={subset.id}>
                        {subset.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ordem de Exibição</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    {' '}Produto Ativo
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="submit-button">
                  {editingProduct ? 'Salvar Alterações' : 'Criar Produto'}
                </button>
                <button type="button" onClick={handleCancel} className="cancel-button">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {!showAddForm && products.length > 0 && (
          <div className="products-list">
            {products.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-image">
                  {product.image ? (
                    <img src={product.image} alt={product.title} />
                  ) : (
                    <div className="no-image">📷</div>
                  )}
                </div>
                <div className="product-info">
                  <h3>{product.title}</h3>
                  <p className="product-description">
                    {product.description1} {product.description2}
                  </p>
                  <div className="product-price">
                    {product.old_price && (
                      <span className="old-price">{product.old_price}</span>
                    )}
                    <span className="new-price">{product.new_price}</span>
                  </div>
                  <div className="product-meta">
                    <span className={`status ${product.is_active ? 'active' : 'inactive'}`}>
                      {product.is_active ? '✅ Ativo' : '❌ Inativo'}
                    </span>
                    <span className="order">Ordem: {product.display_order}</span>
                  </div>
                </div>
                <div className="product-actions">
                  <button onClick={() => handleEdit(product)} className="edit-button">
                    ✏️ Editar
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="delete-button">
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
