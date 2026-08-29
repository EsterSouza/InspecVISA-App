import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { PAGE_SIZE, usePagedList } from '../components/schedules/appointmentRequestsShared';
import { generateId } from '../utils/imageUtils';
import { UF_OPTIONS, toUF } from '../utils/state';
import { useNavigate } from 'react-router-dom';
import { ClientService } from '../services/clientService';
import { AppointmentAdminService, type ClientPortalAccountRow } from '../services/appointmentAdminService';
import { ClientPortalManagement } from '../components/clients/ClientPortalManagement';
import { toast } from '../store/useToastStore';
import { rawErrorMessage } from '../utils/errors';

type ClientsTab = 'clientes' | 'portal';

export function Clients() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ClientsTab>('clientes');
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<ClientCategory | 'all'>('all');
  const [sortDir, setSortDir] = useState<'ascending' | 'descending'>('ascending');
  // Cards é o principal (decisão da Ester em 17/08); a tabela densa é visualização alternativa,
  // do mesmo jeito que a agenda tem Semana / Lista (decisão 13).
  const [view, setView] = useState<'cards' | 'tabela'>('cards');
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
    } catch (err) {
      console.error(err);
      setLoadError(rawErrorMessage(err) || 'Verifique sua conexão e tente novamente.');
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
    } catch (err) {
      console.error(err);
      toast.error(rawErrorMessage(err) || 'Erro ao salvar cliente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    // `state` era texto livre; normaliza para a sigla do select sem perder o valor antigo.
    // `hasEvidenceSupport` ausente (linha de cache anterior ao PORT-06) vale como ligado — sem
    // isto a caixa abriria desmarcada e salvar tiraria o envio de evidência sem ninguém pedir.
    reset({
      ...client,
      state: toUF(client.state) || client.state,
      hasEvidenceSupport: client.hasEvidenceSupport !== false,
    });
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
    } catch (err) {
      console.error(err);
      toast.error(rawErrorMessage(err) || 'Erro ao excluir cliente.');
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

  // `clients` já chega filtrado por busca/categoria do `loadClients`; aqui só a ordem da tabela.
  const sortedClients = useMemo(() => {
    const factor = sortDir === 'ascending' ? 1 : -1;
    return [...clients].sort((a, b) => factor * a.name.localeCompare(b.name, 'pt-BR'));
  }, [clients, sortDir]);
  const { page, totalPages, items: pagedClients, setPage } = usePagedList(sortedClients, `${search}|${filterCat}|${sortDir}`);

  // Mexer no filtro ou na ordem volta para a primeira página: senão quem estava na página 3 e
  // limpa a busca cai na cauda da lista, sem nada na tela explicando por quê.

  // O que cada linha mostra, calculado uma vez: a tabela (desktop) e os cards (celular) leem daqui.
  const pagedRows = pagedClients.map((client) => ({
    client,
    portalAccesses: portalAccessByClient.get(client.id) || [],
    phone: client.contacts?.find((contact) => contact.phone)?.phone || client.phone,
    // Cadastro antigo às vezes só tem `address`; sem isso a coluna ficava vazia sem motivo.
    place: [client.city, toUF(client.state) || client.state].filter(Boolean).join('/') || client.address,
  }));

  return (
    <PageShell>
      <PageHeader
        title="Clientes"
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
          onChange={(e) => setFilterCat(e.target.value as ClientCategory | 'all')}
          aria-label="Filtrar por categoria"
        >
          <option value="all">Todas Categorias</option>
          <option value="estetica">Estética</option>
          <option value="ilpi">ILPI</option>
          <option value="alimentos">Alimentos</option>
        </Select>
      </div>

      <div className="mb-4 flex justify-end">
        <div className="inline-flex gap-0.5 rounded-md border border-default bg-surface-sunken p-0.5">
          {([['cards', 'Cards'], ['tabela', 'Tabela']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors [@media(pointer:coarse)]:min-h-11 ${
                view === key ? 'bg-surface text-primary-700 shadow-sm' : 'text-navy-3 hover:text-navy'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-default bg-surface">
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
        <div className="rounded-lg border border-default bg-surface">
          {search || filterCat !== 'all' ? (
            <EmptyState
              icon={<FilterX className="h-8 w-8" />}
              title="Nada com este filtro"
              description="Nenhum cliente para a busca ou categoria atual."
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
      ) : view === 'cards' ? (
        <div className="space-y-4">
          {pagedRows.map(({ client, portalAccesses, phone, place }) => (
            <Card
              key={client.id}
              className="p-5 hover:border-primary-200 hover:shadow-md transition-[border-color,box-shadow] cursor-pointer group"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
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
                    {phone && (
                      <div className="flex items-center">
                        <Phone className="mr-2 h-4 w-4 text-navy-3" /> {phone}
                      </div>
                    )}
                    {place && (
                      <div className="flex items-center col-span-1 sm:col-span-2">
                        <MapPin className="mr-2 h-4 w-4 text-navy-3" /> {place}
                      </div>
                    )}
                  </div>
                </div>
                {/* Sempre visíveis: no toque não existe hover, e antes elas só apareciam com o cursor em cima. */}
                <div className="ml-4 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Editar ${client.name}`}
                    title="Editar cliente"
                    onClick={(e) => handleEdit(client, e)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Excluir ${client.name}`}
                    title="Excluir cliente"
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                    onClick={(e) => handleDelete(client, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          <Pagination
            page={page}
            pageCount={totalPages}
            onPageChange={setPage}
            totalItems={sortedClients.length}
            pageSize={PAGE_SIZE}
            className="rounded-lg border border-default"
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-default bg-surface">
          <div className="overflow-x-auto">
            <Table aria-label="Clientes">
              <TableHeader>
                <TableRow>
                  <TableHead
                    sortDirection={sortDir}
                    onSort={() => setSortDir((d) => (d === 'ascending' ? 'descending' : 'ascending'))}
                  >
                    Cliente
                  </TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="hidden xl:table-cell">Portal</TableHead>
                  <TableHead align="right"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map(({ client, portalAccesses, phone, place }) => (
                    <TableRow
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/clients/${client.id}`);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell primary className="max-w-[240px]">
                        <p className="truncate">{client.name}</p>
                        {(client.responsibleName || client.cnpj) && (
                          <p className="truncate text-xs font-normal text-navy-3">
                            {[client.responsibleName, client.cnpj].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          client.category === 'estetica' ? 'success' :
                          client.category === 'ilpi' ? 'warning' : 'default'
                        }>
                          {client.category?.toUpperCase() || 'SEM CATEGORIA'}
                        </Badge>
                        {client.category === 'alimentos' && !!client.foodTypes?.length && (
                          <p className="mt-0.5 max-w-[180px] truncate text-xs text-navy-3">
                            {client.foodTypes.map((ft) => FOOD_SEGMENT_LABELS[ft as FoodEstablishmentType] || ft).join(', ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {place || <span className="text-navy-3">—</span>}
                      </TableCell>
                      <TableCell>
                        {phone || <span className="text-navy-3">—</span>}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell max-w-[200px]">
                        {portalAccesses.length > 0 ? (
                          <span className="flex items-center gap-1 truncate text-xs font-semibold text-primary-700">
                            <KeyRound className="h-3 w-3 shrink-0" />
                            {portalAccesses.map((account) => account.name).join(', ')}
                          </span>
                        ) : (
                          <span className="text-navy-3">—</span>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {/* Sempre visíveis: no toque não existe hover, e antes elas só apareciam com o cursor em cima. */}
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Editar ${client.name}`}
                            title="Editar cliente"
                            onClick={(e) => handleEdit(client, e)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Excluir ${client.name}`}
                            title="Excluir cliente"
                            className="text-danger hover:bg-danger-soft hover:text-danger"
                            onClick={(e) => handleDelete(client, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={page}
            pageCount={totalPages}
            onPageChange={setPage}
            totalItems={sortedClients.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}
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

          {/*
            PORT-07 — as três marcações nascem desmarcadas e são perguntadas aqui, no cadastro.
            Antes elas só existiam na tela de detalhe do cliente, então um cliente novo herdava
            um contrato que ninguém tinha escolhido. Cada uma libera algo concreto no portal;
            o detalhe do cliente continua sendo o lugar de mexer nelas depois.
          */}
          <fieldset className="space-y-3 rounded-2xl border border-default bg-surface-sunken/70 p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-navy-2">
              O que o contrato inclui
            </legend>
            <div>
              <Checkbox
                {...register('hasPersonalizedSanitaryFolder')}
                label="Pasta sanitária personalizada"
              />
              <p className="ml-6 mt-1 text-xs text-navy-3">
                Libera a pasta no Drive pelo portal e o pedido de elaboração de documentos.
              </p>
            </div>
            <div>
              <Checkbox {...register('hasAuditService')} label="Auditoria" />
              <p className="ml-6 mt-1 text-xs text-navy-3">
                Fiscalização recorrente, com relatório e plano de ação. O cliente passa a poder
                agendá-la pelo portal.
              </p>
            </div>
            <div>
              <Checkbox {...register('hasOnlineFollowup')} label="Acompanhamento online" />
              <p className="ml-6 mt-1 text-xs text-navy-3">
                Encontros periódicos à distância, agendáveis pelo portal.
              </p>
            </div>
            <div>
              <Checkbox
                {...register('hasEvidenceSupport')}
                label="Revisão de evidências de correção"
              />
              <p className="ml-6 mt-1 text-xs text-navy-3">
                Deixe desmarcado no contrato só de vistoria. O cliente continua vendo o plano de
                ação e marcando o que já resolveu, mas sem anexar arquivo.
              </p>
            </div>
          </fieldset>

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
