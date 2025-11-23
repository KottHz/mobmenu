import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../contexts/StoreContext';
import { clearProductsCache } from '../../services/productService';
import AdminLayout from '../../components/admin/AdminLayout';
import './Sections.css';

interface Set {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  store_id: string;
}

export default function AdminSections() {
  const { store } = useStore();
  const [sets, setSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSet, setEditingSet] = useState<Set | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    display_order: 0,
    is_active: true,
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (store?.id) {
      loadSets();
    }
  }, [store?.id]);

  const loadSets = async () => {
    if (!store?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sets')
        .select('*')
        .eq('store_id', store.id)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setSets(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar seções:', error);
      setMessage(`❌ Erro ao carregar seções: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingSet(null);
    // Se não há seções, começar com 0. Se há, pegar o maior + 1
    const maxOrder = sets.length > 0 ? Math.max(...sets.map(s => s.display_order)) : -1;
    setFormData({
      name: '',
      display_order: maxOrder + 1,
      is_active: true,
    });
    setShowAddForm(true);
    setMessage('');
  };

  const handleEdit = (set: Set) => {
    setEditingSet(set);
    setFormData({
      name: set.name,
      display_order: set.display_order,
      is_active: set.is_active,
    });
    setShowAddForm(true);
    setMessage('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta seção?')) return;

    try {
      const { error } = await supabase
        .from('sets')
        .delete()
        .eq('id', id)
        .eq('store_id', store?.id);

      if (error) throw error;

      setMessage('✅ Seção excluída com sucesso!');
      
      // Limpar cache de produtos para forçar recarregamento
      clearProductsCache();
      
      loadSets();
    } catch (error: any) {
      console.error('Erro ao excluir seção:', error);
      setMessage(`❌ Erro ao excluir seção: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store?.id) return;

    setMessage('');

    try {
      if (editingSet) {
        // Atualizar seção existente
        const { error } = await supabase
          .from('sets')
          .update({
            name: formData.name,
            display_order: formData.display_order,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSet.id)
          .eq('store_id', store.id);

        if (error) throw error;

        setMessage('✅ Seção atualizada com sucesso!');
      } else {
        // Criar nova seção
        const { error } = await supabase
          .from('sets')
          .insert({
            name: formData.name,
            display_order: formData.display_order,
            is_active: formData.is_active,
            store_id: store.id,
          });

        if (error) throw error;

        setMessage('✅ Seção criada com sucesso!');
      }

      // Limpar cache de produtos para forçar recarregamento
      clearProductsCache();
      
      setShowAddForm(false);
      setEditingSet(null);
      await loadSets();
    } catch (error: any) {
      console.error('Erro ao salvar seção:', error);
      setMessage(`❌ Erro ao salvar seção: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingSet(null);
    setFormData({
      name: '',
      display_order: 0,
      is_active: true,
    });
    setMessage('');
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="loading">Carregando seções...</div>
      </AdminLayout>
    );
  }

  // Se não há seções e não está mostrando o formulário, mostrar apenas o empty state centralizado
  if (sets.length === 0 && !showAddForm) {
    return (
      <AdminLayout>
        <div className="sections-admin-page">
          {message && (
            <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
          <div className="empty-state">
            <div className="empty-icon">📑</div>
            <h3>Nenhuma seção criada</h3>
            <p>Comece criando sua primeira seção para organizar seus produtos</p>
            <button className="add-button" onClick={handleAdd}>
              ➕ Criar Primeira Seção
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="sections-admin-page">
        <div className="page-header">
          <div>
            <h1>Gerenciamento de Seções</h1>
            <p className="subtitle">Organize seus produtos em categorias e seções personalizadas</p>
          </div>
        </div>

        {message && (
          <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {showAddForm && (
          <div className="form-card">
            <h2>{editingSet ? 'Editar Seção' : 'Nova Seção'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome da Seção *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Queijos Artesanais"
                  required
                />
              </div>

              <div className="form-group">
                <label>Ordem de Exibição</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  min="0"
                />
                <small>Seções com menor número aparecem primeiro</small>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Seção ativa (visível na loja)</span>
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="save-button">
                  {editingSet ? '💾 Salvar Alterações' : '➕ Criar Seção'}
                </button>
                <button type="button" onClick={handleCancel} className="cancel-button">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {sets.length > 0 && (
          <div className="sets-list">
            <div className="sets-grid">
              {sets.map((set) => (
                <div key={set.id} className="set-card">
                  <div className="set-header">
                    <h3>{set.name}</h3>
                    <div className="set-badge">
                      {set.is_active ? (
                        <span className="badge active">Ativa</span>
                      ) : (
                        <span className="badge inactive">Inativa</span>
                      )}
                    </div>
                  </div>
                  <div className="set-info">
                    <p><strong>Ordem:</strong> {set.display_order}</p>
                  </div>
                  <div className="set-actions">
                    <button
                      className="edit-button"
                      onClick={() => handleEdit(set)}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(set.id)}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
