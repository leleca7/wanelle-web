'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { neon } from '@/lib/neon';

type Member = { user_id: string; role: 'admin' | 'staff'; active: boolean };
type OrderItem = { product_name: string; flavor?: string | null; size?: string | null; quantity: number };
type Customer = { name: string; whatsapp?: string | null };
type Order = {
  id: string;
  status: string;
  fulfillment: 'retirada' | 'entrega';
  due_at?: string | null;
  total_amount: number | string;
  paid_amount: number | string;
  payment_method?: string | null;
  customers?: Customer | null;
  order_items?: OrderItem[];
};
type StockItem = { id: string; name: string; unit: string; current_quantity: number | string; minimum_quantity: number | string };
type FinanceEntry = { id: string; entry_type: 'entrada' | 'saida'; amount: number | string; entry_date: string };

const statusLabels: Record<string, string> = {
  novo: 'Novo',
  aguardando_confirmacao: 'Aguardando',
  confirmado: 'Confirmado',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const kanbanStatuses = ['aguardando_confirmacao', 'confirmado', 'em_producao', 'pronto'];

const emptyForm = {
  customer: '', whatsapp: '', product: '', flavor: '', size: '', quantity: '1',
  date: '', time: '', fulfillment: 'retirada', total: '', paid: '', payment: 'Pix', notes: '',
};

function money(value: number | string | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ id: string; name?: string | null; email?: string | null } | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [finance, setFinance] = useState<FinanceEntry[]>([]);
  const [tab, setTab] = useState<'dashboard' | 'orders'>('dashboard');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');

  useEffect(() => { void boot(); }, []);

  async function boot() {
    setLoading(true);
    const session = await neon.auth.getSession();
    if (!session.data?.user) {
      router.replace('/login');
      return;
    }

    const currentUser = session.data.user;
    setUser({ id: currentUser.id, name: currentUser.name, email: currentUser.email });

    const { data: memberRows } = await neon
      .from('app_members')
      .select('user_id, role, active')
      .eq('user_id', currentUser.id);

    const currentMember = Array.isArray(memberRows) && memberRows.length ? memberRows[0] as Member : null;
    setMember(currentMember);
    if (currentMember?.active) await loadData();
    setLoading(false);
  }

  async function loadData() {
    const [ordersResult, stockResult, financeResult] = await Promise.all([
      neon.from('orders').select('id,status,fulfillment,due_at,total_amount,paid_amount,payment_method,customers(name,whatsapp),order_items(product_name,flavor,size,quantity)').order('due_at', { ascending: true }),
      neon.from('inventory_items').select('id,name,unit,current_quantity,minimum_quantity').order('name', { ascending: true }),
      neon.from('financial_entries').select('id,entry_type,amount,entry_date').order('entry_date', { ascending: false }),
    ]);

    if (!ordersResult.error) setOrders((ordersResult.data ?? []) as Order[]);
    if (!stockResult.error) setStock((stockResult.data ?? []) as StockItem[]);
    if (!financeResult.error) setFinance((financeResult.data ?? []) as FinanceEntry[]);
  }

  const today = new Date().toDateString();
  const todayOrders = useMemo(() => orders.filter((o) => o.due_at && new Date(o.due_at).toDateString() === today), [orders, today]);
  const inProduction = orders.filter((o) => o.status === 'em_producao').length;
  const receivable = orders.reduce((sum, o) => sum + Math.max(0, Number(o.total_amount) - Number(o.paid_amount)), 0);
  const lowStock = stock.filter((s) => Number(s.current_quantity) <= Number(s.minimum_quantity));
  const monthKey = new Date().toISOString().slice(0, 7);
  const revenue = finance.filter((e) => e.entry_type === 'entrada' && e.entry_date.startsWith(monthKey)).reduce((s, e) => s + Number(e.amount), 0);
  const expenses = finance.filter((e) => e.entry_type === 'saida' && e.entry_date.startsWith(monthKey)).reduce((s, e) => s + Number(e.amount), 0);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const { data: customer, error: customerError } = await neon
        .from('customers')
        .insert({ name: form.customer, whatsapp: form.whatsapp || null })
        .select('id')
        .single();
      if (customerError || !customer) throw customerError ?? new Error('Cliente não criado.');

      const dueAt = new Date(`${form.date}T${form.time}`).toISOString();
      const total = Number(form.total || 0);
      const paid = Number(form.paid || 0);

      const { data: order, error: orderError } = await neon
        .from('orders')
        .insert({
          customer_id: customer.id,
          status: 'aguardando_confirmacao',
          fulfillment: form.fulfillment,
          due_at: dueAt,
          customization: form.notes || null,
          total_amount: total,
          paid_amount: paid,
          payment_method: form.payment || null,
        })
        .select('id')
        .single();
      if (orderError || !order) throw orderError ?? new Error('Pedido não criado.');

      const { error: itemError } = await neon.from('order_items').insert({
        order_id: order.id,
        product_name: form.product,
        flavor: form.flavor || null,
        size: form.size || null,
        quantity: Number(form.quantity || 1),
        unit_price: total / Math.max(1, Number(form.quantity || 1)),
        notes: form.notes || null,
      });
      if (itemError) throw itemError;

      await neon.from('calendar_events').insert({
        title: `${form.product} — ${form.customer}`,
        event_type: form.fulfillment,
        starts_at: dueAt,
        order_id: order.id,
      });

      if (paid > 0) {
        await neon.from('financial_entries').insert({
          entry_type: 'entrada',
          category: 'pedido',
          description: `Pagamento inicial — ${form.customer}`,
          amount: paid,
          order_id: order.id,
          payment_method: form.payment,
        });
      }

      setForm(emptyForm);
      setModal(false);
      setNotice('Pedido salvo com sucesso.');
      await loadData();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Não foi possível salvar o pedido.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await neon.from('orders').update({ status }).eq('id', id);
    if (error) setNotice('Não foi possível atualizar o pedido.');
    else await loadData();
  }

  async function signOut() {
    await neon.auth.signOut();
    window.location.href = '/login';
  }

  if (loading) return <main className="center-state">Carregando Wanelle…</main>;

  if (!member?.active) {
    return (
      <main className="access-shell">
        <section className="access-card">
          <Image src="/wanelle-logo.png" alt="Wanelle Tortas" width={320} height={120} priority />
          <p className="eyebrow">Acesso protegido</p>
          <h1>Conta criada. Falta liberar o acesso.</h1>
          <p className="muted">Seu cadastro no Neon Auth funcionou, mas ainda não está na lista de membros da Wanelle.</p>
          <div className="user-code"><span>ID do usuário</span><code>{user?.id}</code></div>
          <p className="small muted">Esse ID é o que usamos para autorizar a primeira conta administrativa.</p>
          <button className="button soft" onClick={signOut}>Sair</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo"><Image src="/wanelle-logo.png" alt="Wanelle Tortas" width={240} height={90} priority /></div>
        <nav>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Pedidos</button>
          <button disabled>Agenda <span>em breve</span></button>
          <button disabled>Estoque <span>em breve</span></button>
          <button disabled>Financeiro <span>em breve</span></button>
          <button disabled>Produtos <span>em breve</span></button>
          <button disabled>Clientes <span>em breve</span></button>
        </nav>
        <div className="sidebar-bottom">
          <p>Bolos feitos para fazer parte da história.</p>
          <button onClick={signOut}>Sair</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="title-row">
            <div className="monogram"><Image src="/wanelle-monograma.png" alt="" width={42} height={42} /></div>
            <div>
              <p className="eyebrow">{tab === 'dashboard' ? new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Operação'}</p>
              <h1>{tab === 'dashboard' ? `Bom dia${user?.name ? `, ${user.name.split(' ')[0]}` : ''}.` : 'Pedidos'}</h1>
              <p className="muted">{tab === 'dashboard' ? 'O que temos para preparar hoje?' : 'Do primeiro contato até a entrega.'}</p>
            </div>
          </div>
          <div className="top-actions">
            <button className="button soft" disabled>Venda rápida</button>
            <button className="button primary" onClick={() => setModal(true)}>+ Novo pedido</button>
          </div>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {tab === 'dashboard' ? (
          <>
            <section className="kpis">
              <Kpi label="Pedidos de hoje" value={String(todayOrders.length).padStart(2, '0')} detail="entregas e retiradas" />
              <Kpi label="Em produção" value={String(inProduction).padStart(2, '0')} detail="pedidos em andamento" />
              <Kpi label="A receber" value={money(receivable)} detail="saldo dos pedidos" />
              <Kpi label="Estoque baixo" value={String(lowStock.length).padStart(2, '0')} detail="itens no mínimo" />
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <div className="panel-head"><div><p className="eyebrow">Agenda</p><h2>Próximas encomendas</h2></div><button className="text-button" onClick={() => setTab('orders')}>Ver pedidos</button></div>
                {orders.length === 0 ? <Empty text="Nenhuma encomenda cadastrada ainda." /> : orders.slice(0, 6).map((order) => <OrderLine key={order.id} order={order} />)}
              </div>

              <div className="stack">
                <div className="panel">
                  <div className="panel-head"><div><p className="eyebrow">Estoque</p><h2>Atenção hoje</h2></div></div>
                  {lowStock.length === 0 ? <Empty text="Nenhum item com estoque baixo." /> : lowStock.slice(0, 5).map((item) => (
                    <div className="stock-line" key={item.id}><div><strong>{item.name}</strong><small>{item.current_quantity} {item.unit} disponíveis</small></div><span>baixo</span></div>
                  ))}
                </div>
                <div className="panel finance-summary">
                  <p className="eyebrow">Este mês</p>
                  <div><span>Faturamento</span><strong>{money(revenue)}</strong></div>
                  <div><span>Despesas</span><strong>{money(expenses)}</strong></div>
                  <div className="result"><span>Resultado</span><strong>{money(revenue - expenses)}</strong></div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="kanban">
            {kanbanStatuses.map((status) => {
              const columnOrders = orders.filter((o) => o.status === status);
              return (
                <div className="kanban-column" key={status}>
                  <div className="column-head"><strong>{statusLabels[status]}</strong><span>{columnOrders.length}</span></div>
                  {columnOrders.length === 0 ? <Empty text="Sem pedidos aqui." /> : columnOrders.map((order) => (
                    <article className="ticket" key={order.id}>
                      <p className="eyebrow">#{order.id.slice(0, 6)}</p>
                      <h3>{order.customers?.name ?? 'Cliente'}</h3>
                      <p>{order.order_items?.[0]?.product_name ?? 'Encomenda'}{order.order_items?.[0]?.flavor ? ` · ${order.order_items[0].flavor}` : ''}</p>
                      <small>{order.due_at ? new Date(order.due_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Data a definir'} · {order.fulfillment}</small>
                      <div className="ticket-bottom"><strong>{money(order.total_amount)}</strong><span>saldo {money(Number(order.total_amount) - Number(order.paid_amount))}</span></div>
                      <label className="status-select">Status<select value={order.status} onChange={(e) => void updateStatus(order.id, e.target.value)}>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
                    </article>
                  ))}
                </div>
              );
            })}
          </section>
        )}
      </main>

      {modal && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setModal(false); }}>
          <section className="modal-card">
            <div className="modal-head"><div><p>Novo pedido</p><h2>Registrar encomenda</h2></div><button onClick={() => setModal(false)} aria-label="Fechar">×</button></div>
            <form className="order-form" onSubmit={createOrder}>
              <Field label="Cliente"><input required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></Field>
              <Field label="WhatsApp"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
              <Field label="Produto"><input required placeholder="Bolo de chocolate" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></Field>
              <Field label="Sabor / recheio"><input value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} /></Field>
              <Field label="Tamanho / peso"><input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
              <Field label="Quantidade"><input type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
              <Field label="Data"><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Horário"><input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
              <Field label="Tipo"><select value={form.fulfillment} onChange={(e) => setForm({ ...form, fulfillment: e.target.value })}><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select></Field>
              <Field label="Pagamento"><select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}><option>Pix</option><option>Dinheiro</option><option>Cartão</option></select></Field>
              <Field label="Valor total"><input required type="number" min="0" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></Field>
              <Field label="Valor pago"><input type="number" min="0" step="0.01" value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value })} /></Field>
              <Field label="Personalização / observações" wide><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <div className="form-actions"><button className="button soft" type="button" onClick={() => setModal(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar pedido'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="kpi"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }

function OrderLine({ order }: { order: Order }) {
  return (
    <div className="order-line">
      <time>{order.due_at ? new Date(order.due_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time>
      <div><strong>{order.customers?.name ?? 'Cliente'}</strong><small>{order.order_items?.[0]?.product_name ?? 'Encomenda'}{order.order_items?.[0]?.flavor ? ` · ${order.order_items[0].flavor}` : ''}</small></div>
      <span>{order.due_at ? new Date(order.due_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</span>
      <b className={`status status-${order.status}`}>{statusLabels[order.status] ?? order.status}</b>
    </div>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>;
}
