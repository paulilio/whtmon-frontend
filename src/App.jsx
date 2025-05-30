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
      setProdutos(res.data || {})
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

  const ordenar = (lista) => {
    const { key, direction } = sortConfig
    const sorted = [...lista].sort((a, b) => {
      const aVal = key === 'valor_parcela'
        ? parseFloat((a[key] || '99999').replace(',', '.').replace('R$', '').trim())
        : (a[key] || '').toString().toLowerCase()

      const bVal = key === 'valor_parcela'
        ? parseFloat((b[key] || '99999').replace(',', '.').replace('R$', '').trim())
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
    let lista = Object.values(produtos).filter(p =>
      (p.classificacao || '') === classificacao
    )

    lista = ordenar(lista)

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '1200px' }}>
          <thead style={{ backgroundColor: '#eee' }}>
            <tr>
              <th onClick={() => handleSort('titulo')} style={getHeaderStyle('titulo')}>Produto</th>
              <th onClick={() => handleSort('codigo')} style={getHeaderStyle('codigo')}>ID</th>
              <th onClick={() => handleSort('valor_parcela')} style={getHeaderStyle('valor_parcela')}>Parcela</th>
              <th>Parcela Raw</th>
              <th>Desconto</th>
              <th>Texto Cupom</th>
              <th>18x</th>
              <th>Preço</th>
              <th>Data</th>
              <th>Ativo</th>
              <th>Link</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const titulo = (p.produto || '[Sem Título]').toString().trim().substring(0, 80)

              return (
                <tr key={p.codigo} style={{ borderBottom: '1px solid #ccc' }}>
                  <td>{titulo}</td>
                  <td><code>{p.codigo}</code></td>
                  <td>{p.valor_parcela || '-'}</td>
                  <td>{p.parcela_raw || '-'}</td>
                  <td>{p.cupom ? '✅ Sim' : '❌ Não'}</td>
                  <td>{p.cupom || '-'}</td>
                  <td>{p.parcela_raw?.includes('18x') ? '✅ Sim' : '❌ Não'}</td>
                  <td>{p.preco || '-'}</td>
                  <td>{p.data || '-'}</td>
                  <td>{p.ativo === false ? '❌ Não' : '✅ Sim'}</td>
                  <td>
                    <a href={p.link} target="_blank" rel="noopener noreferrer">🔗</a>
                  </td>
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
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Monitor de Produtos</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        {Object.keys(classificacoes).map((key) => (
          <button
            key={key}
            onClick={() => {
              setAbaAtiva(key)
              setSortConfig({ key: 'valor_parcela', direction: 'asc' })
            }}
            style={{
              padding: '8px 12px',
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
          <h2>{abaAtiva}</h2>
          {renderProdutos(abaAtiva)}
        </div>
      )}
    </div>
  )
}

export default App
