'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { neon } from '@/lib/neon';

type User = { id: string; name?: string | null; email?: string | null };
type Member = { user_id: string; role: string; active: boolean };
type Order = {
  id: string;
  status: string;
  fulfillment: string;
  due_at?: string | null;
  total_amount: number | string;
  paid_amount: number | string;
  customers?: { name: string; whatsapp?: string | null } | null;
  order_items?: Array<{ product_name: string; flavor?: string | null; size?: string | null }>;
};
type Stock = { id: string; name: string; unit: string; current_quantity: number | string; minimum_quantity: number | string };
type Entry = { id: string; entry_type: string; amount: number | string; entry_date: string };

const labels: Record<string, string> = {
  novo: 'Novo',
  aguardando_confirmacao: 'Aguardando',
  confirmado: 'Confirmado',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const columns = ['aguardando_confirmacao', 'confirmado', 'em_producao', 'pronto'];
const blank = { customer: '', whatsapp: '', product: '', flavor: '', size: '', date: '', time: '', total: '', paid: '', fulfillment: 'retirada', payment: 'Pix', notes: '' };

function brl(value: number | string) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Home() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<'dashboard' | 'orders'>('dashboard');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState('');

  useEffect(() => { void start(); }, []);

  async function start() {
    const session = await neon.auth.getSession();
    if (!session.data?.user) {
      router.replace('/login');
      return;
    }

    const current = session.data.user as User;
    setUser(current);

    const membership = await neon.from('app_members').select('user_id,role,active').eq('user_id', current.id);
    const row = Array.isArray(membership.data) && membership.data.length ? membership.data[0] as Member : null;
    setMember(row);
    if (row?.active) await refresh();
    setBooting(false);
  }

  async function refresh() {
    const [o, s, f] = await Promise.all([
      neon.from('orders').select('id,status,fulfillment,due_at,total_amount,paid_amount,customers(name,whatsapp),order_items(product_name,flavor,size)').order('due_at', { ascending: true }),
      neon.from('inventory_items').select('id,name,unit,current_quantity,minimum_quantity').order('name', { ascending: true }),
      neon.from('financial_entries').select('id,entry_type,amount,entry_date').order('entry_date', { ascending: false }),
    ]);
    if (!o.error) setOrders((o.data ?? []) as unknown as Order[]);
    if (!s.error) setStock((s.data ?? []) as Stock[]);
    if (!f.error) setEntries((f.data ?? []) as Entry[]);
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const customerResult = await neon.from('customers').insert({ name: form.customer, whatsapp: form.whatsapp || null }).select('id').single();
      if (customerResult.error || !customerResult.data) throw customerResult.error ?? new Error('Não foi possível cadastrar o cliente.');

      const dueAt = new Date(`${form.date}T${form.time}`).toISOString();
      const total = Number(form.total || 0);
      const paid = Number(form.paid || 0);

      const orderResult = await neon.from('orders').insert({
        customer_id: customerResult.data.id,
        status: 'aguardando_confirmacao',
        fulfillment: form.fulfillment,
        due_at: dueAt,
        customization: form.notes || null,
        total_amount: total,
        paid_amount: paid,
        payment_method: form.payment,
      }).select('id').single();
      if (orderResult.error || !orderResult.data) throw orderResult.error ?? new Error('Não foi possível cadastrar o pedido.');

      const orderId = orderResult.data.id;
      const itemResult = await neon.from('order_items').insert({
        order_id: orderId,
        product_name: form.product,
        flavor: form.flavor || null,
        size: form.size || null,
        quantity: 1,
        unit_price: total,
        notes: form.notes || null,
      });
      if (itemResult.error) throw itemResult.error;

      await neon.from('calendar_events').insert({ title: `${form.product} — ${form.customer}`, event_type: form.fulfillment, starts_at: dueAt, order_id: orderId });
      if (paid > 0) await neon.from('financial_entries').insert({ entry_type: 'entrada', category: 'pedido', description: `Pagamento — ${form.customer}`, amount: paid, order_id: orderId, payment_method: form.payment });

      setForm(blank);
      setModal(false);
      setMessage('Pedido salvo com sucesso.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o pedido.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(orderId: string, status: string) {
    const result = await neon.from('orders').update({ status }).eq('id', orderId);
    if (result.error) setMessage('Não foi possível atualizar o status.');
    else await refresh();
  }

  async function logout() {
    await neon.auth.signOut();
    window.location.href = '/login';
  }

  if (booting) return <main className="center-state">Carregando Wanelle…</main>;

  if (!member?.active) {
    return (
      <main className="access-shell">
        <section className="access-card">
          <Image src="/wanelle-logo.webp" alt="Wanelle Tortas" width={340} height={128} priority />
          <p className="eyebrow">Acesso protegido</p>
          <h1>Conta criada. Falta liberar o acesso.</h1>
          <p className="muted">O login funcionou. Agora essa conta precisa ser adicionada à equipe da Wanelle.</p>
          <div className="user-code"><span>ID do usuário</span><code>{user?.id}</code></div>
          <p className="small muted">Guarde este ID. Ele permite autorizar esta conta como administradora sem abrir o banco para outros cadastros.</p>
          <button className="button soft" onClick={logout}>Sair</button>
        </section>
      </main>
    );
  }

  const todayKey = new Date().toDateString();
  const todayOrders = orders.filter((order) => order.due_at && new Date(order.due_at).toDateString() === todayKey);
  const production = orders.filter((order) => order.status === 'em_producao').length;
  const receivable = orders.reduce((sum, order) => sum + Math.max(0, Number(order.total_amount) - Number(order.paid_amount)), 0);
  const low = stock.filter((item) => Number(item.current_quantity) <= Number(item.minimum_quantity));
  const month = new Date().toISOString().slice(0, 7);
  const revenue = entries.filter((entry) => entry.entry_type === 'entrada' && entry.entry_date.startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount), 0);
  const expenses = entries.filter((entry) => entry.entry_type === 'saida' && entry.entry_date.startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount), 0);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo"><Image src="/wanelle-logo.webp" alt="Wanelle Tortas" width={220} height={82} priority /></div>
        <nav>
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
          <button className={view === 'orders' ? 'active' : ''} onClick={() => setView('orders')}>Pedidos</button>
          <button disabled>Agenda <span>em breve</span></button>
          <button disabled>Estoque <span>em breve</span></button>
          <button disabled>Financeiro <span>em breve</span></button>
          <button disabled>Produtos <span>em breve</span></button>
          <button disabled>Clientes <span>em breve</span></button>
        </nav>
        <div className="sidebar-bottom"><p>Bolos feitos para fazer parte da história.</p><button onClick={logout}>Sair</button></div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="title-row">
            <div className="monogram"><Image src="/wanelle-monograma.webp" alt="" width={40} height={42} /></div>
            <div>
              <p className="eyebrow">{view === 'dashboard' ? new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Operação'}</p>
              <h1>{view === 'dashboard' ? `Bom dia${user?.name ? `, ${user.name.split(' ')[0]}` : ''}.` : 'Pedidos'}</h1>
              <p className="muted">{view === 'dashboard' ? 'O que temos para preparar hoje?' : 'Do primeiro contato até a entrega.'}</p>
            </div>
          </div>
          <div className="top-actions"><button className="button soft" disabled>Venda rápida</button><button className="button primary" onClick={() => setModal(true)}>+ Novo pedido</button></div>
        </header>

        {message && <div className="notice">{message}</div>}

        {view === 'dashboard' ? (
          <>
            <section className="kpis">
              <Kpi label="Pedidos de hoje" value={String(todayOrders.length).padStart(2, '0')} detail="entregas e retiradas" />
              <Kpi label="Em produção" value={String(production).padStart(2, '0')} detail="pedidos em andamento" />
              <Kpi label="A receber" value={brl(receivable)} detail="saldo dos pedidos" />
              <Kpi label="Estoque baixo" value={String(low.length).padStart(2, '0')} detail="itens no mínimo" />
            </section>
            <section className="dashboard-grid">
              <section className="panel">
                <div className="panel-head"><div><p className="eyebrow">Agenda</p><h2>Próximas encomendas</h2></div><button className="text-button" onClick={() => setView('orders')}>Ver pedidos</button></div>
                {orders.length === 0 ? <Empty text="Nenhuma encomenda cadastrada ainda." /> : orders.slice(0, 6).map((order) => <OrderRow key={order.id} order={order} />)}
              </section>
              <div className="stack">
                <section className="panel"><div className="panel-head"><div><p className="eyebrow">Estoque</p><h2>Atenção hoje</h2></div></div>{low.length === 0 ? <Empty text="Nenhum item com estoque baixo." /> : low.slice(0, 5).map((item) => <div className="stock-line" key={item.id}><div><strong>{item.name}</strong><small>{item.current_quantity} {item.unit} disponíveis</small></div><span>baixo</span></div>)}</section>
                <section className="panel finance-summary"><p className="eyebrow">Este mês</p><div><span>Faturamento</span><strong>{brl(revenue)}</strong></div><div><span>Despesas</span><strong>{brl(expenses)}</strong></div><div className="result"><span>Resultado</span><strong>{brl(revenue - expenses)}</strong></div></section>
              </div>
            </section>
          </>
        ) : (
          <section className="kanban">
            {columns.map((status) => {
              const list = orders.filter((order) => order.status === status);
              return <div className="kanban-column" key={status}><div className="column-head"><strong>{labels[status]}</strong><span>{list.length}</span></div>{list.length === 0 ? <Empty text="Sem pedidos aqui." /> : list.map((order) => <Ticket key={order.id} order={order} onStatus={changeStatus} />)}</div>;
            })}
          </section>
        )}
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setModal(false); }}><section className="modal-card">
        <div className="modal-head"><div><p>Novo pedido</p><h2>Registrar encomenda</h2></div><button onClick={() => setModal(false)} aria-label="Fechar">×</button></div>
        <form className="order-form" onSubmit={saveOrder}>
          <Field label="Cliente"><input required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></Field>
          <Field label="WhatsApp"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
          <Field label="Produto"><input required placeholder="Bolo de chocolate" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></Field>
          <Field label="Sabor / recheio"><input value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} /></Field>
          <Field label="Tamanho / peso"><input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
          <Field label="Tipo"><select value={form.fulfillment} onChange={(e) => setForm({ ...form, fulfillment: e.target.value })}><option value="retirada">Retirada</option><option value="entrega">Entrega</option></select></Field>
          <Field label="Data"><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Horário"><input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          <Field label="Valor total"><input required type="number" min="0" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></Field>
          <Field label="Valor pago"><input type="number" min="0" step="0.01" value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value })} /></Field>
          <Field label="Pagamento"><select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}><option>Pix</option><option>Dinheiro</option><option>Cartão</option></select></Field>
          <Field label="Personalização / observações" wide><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="form-actions"><button className="button soft" type="button" onClick={() => setModal(false)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar pedido'}</button></div>
        </form>
      </section></div>}
    </div>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="kpi"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>; }

function OrderRow({ order }: { order: Order }) {
  return <div className="order-line"><time>{order.due_at ? new Date(order.due_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time><div><strong>{order.customers?.name ?? 'Cliente'}</strong><small>{order.order_items?.[0]?.product_name ?? 'Encomenda'}{order.order_items?.[0]?.flavor ? ` · ${order.order_items[0].flavor}` : ''}</small></div><span>{order.due_at ? new Date(order.due_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</span><b className={`status status-${order.status}`}>{labels[order.status] ?? order.status}</b></div>;
}

function Ticket({ order, onStatus }: { order: Order; onStatus: (id: string, status: string) => Promise<void> }) {
  return <article className="ticket"><p className="eyebrow">#{order.id.slice(0, 6)}</p><h3>{order.customers?.name ?? 'Cliente'}</h3><p>{order.order_items?.[0]?.product_name ?? 'Encomenda'}{order.order_items?.[0]?.flavor ? ` · ${order.order_items[0].flavor}` : ''}</p><small>{order.due_at ? new Date(order.due_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Data a definir'} · {order.fulfillment}</small><div className="ticket-bottom"><strong>{brl(order.total_amount)}</strong><span>saldo {brl(Number(order.total_amount) - Number(order.paid_amount))}</span></div><label className="status-select">Status<select value={order.status} onChange={(e) => void onStatus(order.id, e.target.value)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></article>;
}
