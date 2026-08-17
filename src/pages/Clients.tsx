import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Search, Plus, Phone, MapPin, Edit2, Trash2, Loader2, WifiOff, KeyRound, AlertTriangle, Users, FilterX } from 'lucide-react';
import { type Client, type ClientCategory, type ClientContact, type FoodEstablishmentType, FOOD_SEGMENT_LABELS } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Checkbox } from '../components/ui/Checkbox';
import { useConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { generateId } from '../utils/imageUtils';
import { UF_OPTIONS, toUF } from '../utils/state';
import { useNavigate } from 'react-router-dom';
import { ClientService } from '../services/clientService';
import { AppointmentAdminService, type ClientPortalAccountRow } from '../services/appointmentAdminService';
import { ClientPortalManagement } from '../components/clients/ClientPortalManagement';
import { toast } from '../store/useToastStore';

type ClientsTab = 'clientes' | 'portal';

export function Clients() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ClientsTab>('clientes');
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<ClientCategory | 'all'>('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portalAccounts, setPortalAccounts] = useState<ClientPortalAccountRow[]>([]);
  const { confirm, confirmDialog } = useConfirmDialog();
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [clientContacts, setClientContacts] = useState<ClientContact[]>([{ name: '', phone: '', email: '' }]);
  
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<Client>();

  const loadClients = useCallback(async () => {
    setIsFetching(true);
    try {
      const [clientList, accountList] = await Promise.allSettled([
        ClientService.getClients(),
        AppointmentAdminService.listPortalAccounts(),
      ]);
      if (accountList.status === 'fulfilled') setPortalAccounts(accountList.value);
      if (clientList.status === 'rejected') throw clientList.reason;
      let list = clientList.value;
      setAllClients(list);

      if (filterCat !== 'all') {
        list = list.filter(c => c.category === filterCat);
      }
      if (search) {
        list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) ||
                                c.cnpj?.includes(search) ||
                                c.responsibleName?.toLowerCase().includes(search.toLowerCase()) ||
                                c.contacts?.some((contact) =>
                                  [contact.name, contact.phone, contact.email]
                                    .filter(Boolean)
                                    .some((value) => value!.toLowerCase().includes(search.toLowerCase()))
                                ));
      }
      setClients(list);
      setLoadError(null);
    } catch (err: any) {
      console.error(err);
      setLoadError(err?.message || 'Verifique sua conexão e tente novamente.');
      toast.error('Erro ao carregar clientes.', 'Verifique sua conexão.');
    } finally {
      setIsFetching(false);
    }
  }, [filterCat, search]);

  useEffect(() => { void loadClients(); }, [loadClients]);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const onSubmit = async (data: Client) => {
    if (!isOnline) {
      toast.error('Sem conexão com a internet.', 'Não é possível salvar no momento.');
      return;
    }

    setIsLoading(true);
    try {
      const contacts = clientContacts
        .map((contact) => ({
          name: contact.name?.trim() || undefined,
          phone: contact.phone?.trim() || undefined,
          email: contact.email?.trim() || undefined,
        }))
        .filter((contact) => contact.name || contact.phone || contact.email);
      const primaryContact = contacts[0];
      const clientToSave: Client = editingClient 
        ? { ...editingClient, ...data }
        : { ...data, id: generateId(), createdAt: new Date() };
      clientToSave.contacts = contacts;
      clientToSave.responsibleName = primaryContact?.name;
      clientToSave.phone = primaryContact?.phone;
      clientToSave.email = primaryContact?.email;

      // Limpeza de campos específicos de categoria
      if (clientToSave.category !== 'alimentos') {
        delete clientToSave.foodTypes;
      } else if (!clientToSave.foodTypes || clientToSave.foodTypes.length === 0) {
        clientToSave.foodTypes = ['servico_alimentacao'];
      }

      // ✅ ONLINE-DIRECT UPSERT: Salva direto no Supabase
      await ClientService.saveClient(clientToSave);

      setIsModalOpen(false);
      setEditingClient(null);
      reset();
      loadClients(); // Recarrega a lista do servidor
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao salvar cliente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    // `state` era texto livre; normaliza para a sigla do select sem perder o valor antigo.
    reset({ ...client, state: toUF(client.state) || client.state });
    setClientContacts(
      client.contacts?.length
        ? client.contacts
        : [{ name: client.responsibleName || '', phone: client.phone || '', email: client.email || '' }]
    );
    setIsModalOpen(true);
  };

  const handleDelete = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOnline) {
      toast.error('Sem conexão com a internet.', 'Não é possível excluir no momento.');
      return;
    }

    const ok = await confirm({
      title: `Excluir o cliente "${client.name}"?`,
      confirmLabel: 'Excluir cliente',
    });
    if (!ok) return;
    try {
      await ClientService.deleteClient(client.id);
      loadClients(); // Recarrega a lista do servidor
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao excluir cliente.');
    }
  };

  const selectedCategory = watch('category');
  const portalAccessByClient = new Map<string, ClientPortalAccountRow[]>();
  for (const account of portalAccounts) {
    for (const clientId of account.client_ids) {
      const current = portalAccessByClient.get(clientId) || [];
      current.push(account);
      portalAccessByClient.set(clientId, current);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Clientes"
        description="Gerencie seus estabelecimentos."
        actions={
          <>
            {!isOnline && (
              <div className="flex items-center text-amber-strong text-sm font-medium">
                <WifiOff className="mr-2 h-4 w-4" /> Offline
              </div>
            )}
            {activeTab === 'clientes' && (
              <Button onClick={() => { setClientContacts([{ name: '', phone: '', email: '' }]); setIsModalOpen(true); }} className="w-full sm:w-auto shadow-lg shadow-primary-100">
                <Plus className="mr-2 h-5 w-5" /> Novo Cliente
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex gap-1 rounded-xl bg-surface-sunken p-1">
        <button
          type="button"
          onClick={() => setActiveTab('clientes')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'clientes'
              ? 'bg-surface text-primary-700 shadow-sm'
              : 'text-navy-3 hover:text-navy-2'
          }`}
        >
          Clientes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('portal')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'portal'
              ? 'bg-surface text-primary-700 shadow-sm'
              : 'text-navy-3 hover:text-navy-2'
          }`}
        >
          Portal do Cliente
        </button>
      </div>

      {activeTab === 'portal' ? (
        <ClientPortalManagement
          accounts={portalAccounts}
          clients={allClients}
          onChanged={() => void loadClients()}
        />
      ) : (
      <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          type="search"
          icon={<Search />}
          placeholder="Buscar por nome, CNPJ..."
          aria-label="Buscar cliente"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="col-span-1 sm:col-span-2"
        />
        <Select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value as any)}
          aria-label="Filtrar por categoria"
        >
          <option value="all">Todas Categorias</option>
          <option value="estetica">Estética</option>
          <option value="ilpi">ILPI</option>
          <option value="alimentos">Alimentos</option>
        </Select>
      </div>

      <div className="space-y-4">
        {loadError ? (
          <div className="rounded-2xl border border-default bg-surface">
            <EmptyState
              role="alert"
              icon={<AlertTriangle className="h-8 w-8 text-danger" />}
              title="Não deu para carregar os clientes"
              description={loadError}
              action={
                <Button size="sm" onClick={() => void loadClients()}>
                  Tentar de novo
                </Button>
              }
            />
          </div>
        ) : isFetching ? (
          <div className="space-y-4" aria-busy="true" aria-label="Carregando clientes">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-default bg-surface">
            {search || filterCat !== 'all' ? (
              <EmptyState
                icon={<FilterX className="h-8 w-8" />}
                title="Nada com este filtro"
                description="Nenhum cliente encontrado para a busca ou categoria atual. O cadastro pode existir, só está escondido."
                action={
                  <Button size="sm" variant="outline" onClick={() => { setSearch(''); setFilterCat('all'); }}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="Nenhum cliente cadastrado ainda"
                description="Cadastre o primeiro estabelecimento para começar a agendar inspeções."
                action={
                  <Button size="sm" onClick={() => { setClientContacts([{ name: '', phone: '', email: '' }]); setIsModalOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Cliente
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          clients.map(client => (
            <Card 
              key={client.id} 
              className="p-5 hover:border-primary-200 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              {(() => {
                const portalAccesses = portalAccessByClient.get(client.id) || [];
                return (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-navy group-hover:text-primary-700 transition-colors">{client.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                     <Badge variant={
                       client.category === 'estetica' ? 'success' : 
                       client.category === 'ilpi' ? 'warning' : 'default'
                     }>
                       {client.category?.toUpperCase() || 'SEM CATEGORIA'}
                     </Badge>
                     {client.category === 'alimentos' && client.foodTypes?.map(ft => (
                       <Badge key={ft} variant="outline" className="bg-amber-soft text-amber-soft-ink border-amber-soft-border">
                         {FOOD_SEGMENT_LABELS[ft as FoodEstablishmentType] || ft}
                       </Badge>
                     ))}
                     {portalAccesses.length > 0 && (
                       <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200">
                         <KeyRound className="mr-1 h-3 w-3" />
                         Portal: {portalAccesses.map((account) => account.name).join(', ')}
                       </Badge>
                     )}
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm text-navy-2">
                    {(client.contacts?.length ? client.contacts : [{ phone: client.phone }]).filter((contact) => contact.phone).slice(0, 2).map((contact, index) => (
                      <div key={index} className="flex items-center">
                        <Phone className="mr-2 h-4 w-4 text-navy-3" /> {contact.phone}
                      </div>
                    ))}
                    {client.address && <div className="flex items-center col-span-1 sm:col-span-2"><MapPin className="mr-2 h-4 w-4 text-navy-3" /> {client.address}</div>}
                  </div>
                </div>
                <div className="flex gap-1 ml-4 group-hover:opacity-100 opacity-0 transition-opacity">
                  <button onClick={(e) => handleEdit(client, e)} className="p-2 text-navy-3 hover:text-primary-600 hover:bg-primary-50 rounded-xl"><Edit2 className="h-5 w-5" /></button>
                  <button onClick={(e) => handleDelete(client, e)} className="p-2 text-navy-3 hover:text-danger hover:bg-danger-soft rounded-xl"><Trash2 className="h-5 w-5" /></button>
                </div>
              </div>
                );
              })()}
            </Card>
          ))
        )}
      </div>
      </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingClient(null); setClientContacts([{ name: '', phone: '', email: '' }]); reset(); }} title={editingClient ? "Editar Cliente" : "Novo Cliente"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nome do Estabelecimento" required error={errors.name && 'Obrigatório'}>
            <Input {...register('name', { required: true })} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria" required>
              <Select {...register('category', { required: true })}>
                <option value="estetica">Estética</option>
                <option value="ilpi">ILPI</option>
                <option value="alimentos">Alimentos</option>
              </Select>
            </Field>
            <Field label="CNPJ">
              <Input {...register('cnpj')} />
            </Field>
          </div>

          {selectedCategory === 'alimentos' && (
            <fieldset className="space-y-3 rounded-2xl border border-amber-soft-border bg-amber-soft/50 p-4">
              <legend className="text-xs font-bold uppercase tracking-wider text-amber-soft-ink">Tipos de Serviço</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(FOOD_SEGMENT_LABELS).map(([val, label]) => (
                  <Checkbox
                    key={val}
                    value={val}
                    label={label}
                    className="text-navy-2"
                    {...register('foodTypes')}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <div className="rounded-2xl border border-default bg-surface-sunken/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-navy">Responsáveis e contatos</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClientContacts((prev) => [...prev, { name: '', phone: '', email: '' }])}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar mais
              </Button>
            </div>
            <div className="space-y-3">
              {clientContacts.map((contact, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-default bg-surface p-3 sm:grid-cols-3">
                  <Input
                    type="text"
                    value={contact.name || ''}
                    onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                    placeholder="Responsável"
                    aria-label={`Responsável ${index + 1}`}
                  />
                  <Input
                    type="tel"
                    value={contact.phone || ''}
                    onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, phone: e.target.value } : item))}
                    placeholder="Telefone"
                    aria-label={`Telefone do responsável ${index + 1}`}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={contact.email || ''}
                      onChange={(e) => setClientContacts((prev) => prev.map((item, i) => i === index ? { ...item, email: e.target.value } : item))}
                      placeholder="E-mail"
                      aria-label={`E-mail do responsável ${index + 1}`}
                      className="min-w-0 flex-1"
                    />
                    {clientContacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setClientContacts((prev) => prev.filter((_, i) => i !== index))}
                        className="rounded-xl p-2 text-danger hover:bg-danger-soft"
                        title="Remover contato"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <Field label="Cidade" className="col-span-2 sm:col-span-1">
              <Input {...register('city')} />
            </Field>
            <Field label="Estado" className="col-span-2 sm:col-span-1">
              <Select {...register('state')}>
                <option value="">Selecione</option>
                {UF_OPTIONS.map(({ uf, name }) => (
                  <option key={uf} value={uf}>{uf} — {name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="pt-6 border-t flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirmar e Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
      {confirmDialog}
    </PageShell>
  );
}
