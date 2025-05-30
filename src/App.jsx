import { useEffect, useState } from 'react'
import axios from 'axios'

const CLASS_CONFIG_URL = 'https://wht-ml-scraper-default-rtdb.firebaseio.com/whtbase/class_config.json'
const PRODUTOS_URL = 'https://wht-ml-scraper-default-rtdb.firebaseio.com/whtbase/produtos.json'
const IGNORE_URL = 'https://wht-ml-scraper-default-rtdb.firebaseio.com/whtbase/ignore'
const CLASS_PROD_URL = 'https://wht-ml-scraper-default-rtdb.firebaseio.com/whtbase/class_prod'

function App() {
  const [classificacoes, setClassificacoes] = useState({})
  const [produtos, setProdutos] = useState({})
  const [abaAtiva, setAbaAtiva] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'valor_parcela', direction: 'asc' })
  const [ultimaData, setUltimaData] = useState('')

  useEffect(() => {
    axios.get(CLASS_CONFIG_URL).then((res) => {
      const raw = res.data || {}
      const listaExpandida = {}

      for (const base in raw) {
        if (raw[base].combo_keywords) listaExpandida[`${base} Combo`] = raw[base].combo_keywords
        if (raw[base].sem_combo_keywords) listaExpandida[`${base} Sem Combo`] = raw[base].sem_combo_keywords
      }

      setClassificacoes(listaExpandida)
      const primeira = Object.keys(listaExpandida)[0]
      setAbaAtiva(primeira)
    })

    axios.get(PRODUTOS_URL).then((res) => {
      const dados = res.data || {}
      setProdutos(dados)

      const datas = Object.values(dados).map((p) => new Date(p.ultima_coleta || 0)).filter(d => d.toString() !== 'Invalid Date')
      const maisRecente = datas.length ? new Date(Math.max(...datas)) : null
      if (maisRecente) {
        const formatado = maisRecente.toLocaleString('pt-BR')
        setUltimaData(formatado)
      }
    })
  }, [])

  const enviarIgnorar = async (codigo) => {
    await axios.put(`${IGNORE_URL}/${codigo}.json`, true)
    alert(`Produto ${codigo} marcado como ignorado.`)
  }

  const enviarClassificacaoManual = async (codigo, classificacao) => {
    await axios.put(`${CLASS_PROD_URL}/${codigo}.json`, classificacao)
    alert(`Produto ${codigo} classificado como ${classificacao}.`)
  }

  const parseParcela = (val) => {
    if (!val) return 99999
    return parseFloat(val.toString().trim().replace(/\./g, '').replace(',', '.'))
  }

  const getResumoPorClasse = () => {
    return Object.keys(classificacoes).map((classe) => {
      const lista = Object.entries(produtos)
        .filter(([codigo, p]) => p.classificacao === classe)
        .map(([codigo, p]) => ({ ...p, codigo }))
        .sort((a, b) => parseParcela(a.valor_parcela) - parseParcela(b.valor_parcela))

      const top3 = lista.slice(0, 3)

      const menoresExistentes = lista.map(p => parseParcela(p.valor_parcela))
      const menorHistorico = Math.min(...menoresExistentes)
      const menorAtual = parseParcela(top3[0]?.valor_parcela || '')
      const comparativo = menorAtual <= menorHistorico ? '⬇️ Novo menor' : '—'

      return (
        <tr key={classe}>
          <td>{classe}</td>
          {[0, 1, 2].map(i => (
            <td key={i} style={{ fontSize: '1.2rem' }}>
              {top3[i]?.valor_parcela ? (
                <a href={top3[i].link} target="_blank" rel="noopener noreferrer">
                  {top3[i].valor_parcela} <span style={{ fontSize: '0.8rem' }}>({top3[i].preco || '-'})</span>
                </a>
              ) : '-'}
            </td>
          ))}
          <td>{comparativo}</td>
        </tr>
      )
    })
  }

  const ordenar = (lista) => {
    const { key, direction } = sortConfig
    const sorted = [...lista].sort((a, b) => {
      const aVal = key === 'valor_parcela'
        ? parseParcela(a[key])
        : (a[key] || '').toString().toLowerCase()

      const bVal = key === 'valor_parcela'
        ? parseParcela(b[key])
        : (b[key] || '').toString().toLowerCase()

      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const renderProdutos = (classificacao) => {
    let lista = Object.entries(produtos)
      .filter(([codigo, p]) => (p.classificacao || '') === classificacao)
      .map(([codigo, p]) => ({ ...p, codigo }))
    lista = ordenar(lista)

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '1000px', fontSize: '0.9rem' }}>
          <thead style={{ backgroundColor: '#f3f3f3' }}>
            <tr>
              <th onClick={() => handleSort('produto')} style={getHeaderStyle('produto')}>Produto</th>
              <th>Ativo</th>
              <th>Preço</th>
              <th onClick={() => handleSort('valor_parcela')} style={getHeaderStyle('valor_parcela')}>Parcela</th>
              <th>18x</th>
              <th>Desconto</th>
              <th>Texto Cupom</th>
              <th>Link</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const titulo = (p.produto || '[Sem Título]').toString().trim().substring(0, 80)
              const descricao = (p.descricao || p.description || '-').toString().trim().substring(0, 100)

              return (
                <tr key={p.codigo} style={{ borderBottom: '1px solid #ddd' }}>
                  <td>{titulo}<br /><small>{p.codigo}</small></td>
                  <td>{p.ativo === false ? '❌' : '✅'}</td>
                  <td>{p.preco || '-'}</td>
                  <td>{p.valor_parcela || '-'}</td>
                  <td>{p.parcela_raw?.includes('18x') ? '✅' : '❌'}</td>
                  <td>{p.cupom ? '✅' : '❌'}</td>
                  <td>{p.cupom || '-'}</td>
                  <td><a href={p.link} target="_blank" rel="noopener noreferrer">🔗</a></td>
                  <td>
                    <button onClick={() => enviarIgnorar(p.codigo)} style={{ marginRight: '5px' }}>IGN</button>
                    <button onClick={() => enviarClassificacaoManual(p.codigo, abaAtiva)}>Classificar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const getHeaderStyle = (key) => ({
    cursor: 'pointer',
    background: sortConfig.key === key ? '#ccc' : undefined,
    padding: '6px'
  })

  return (
    <div style={{ padding: '16px', maxWidth: '100%', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Resumo <span style={{ fontSize: '1rem', color: '#555' }}>({ultimaData})</span></h1>
      <table style={{ width: '100%', marginBottom: '24px', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead style={{ background: '#eee' }}>
          <tr>
            <th>Classe</th>
            <th>Parc1</th>
            <th>Parc2</th>
            <th>Parc3</th>
            <th>Comparativo</th>
          </tr>
        </thead>
        <tbody>
          {getResumoPorClasse()}
        </tbody>
      </table>

      <h1 style={{ fontSize: '1.5rem' }}>Monitor de Produtos</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {Object.keys(classificacoes).map((key) => (
          <button
            key={key}
            onClick={() => {
              setAbaAtiva(key)
              setSortConfig({ key: 'valor_parcela', direction: 'asc' })
            }}
            style={{
              padding: '10px 12px',
              fontSize: '1rem',
              backgroundColor: abaAtiva === key ? '#aaa' : '#ddd',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {key}
          </button>
        ))}
      </div>

      {abaAtiva && (
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>{abaAtiva}</h2>
          {renderProdutos(abaAtiva)}
        </div>
      )}
    </div>
  )
}

export default App
