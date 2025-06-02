import { useEffect, useState } from 'react'
import axios from 'axios'

const CLASS_CONFIG_URL = 'https://wht-ml-scraper-default-rtdb.firebaseio.com/whtbase/class_config.json'
const PRODUTOS_URL = 'https://wht-ml-scraper-default-rtdb.firebaseio.com/whtbase/produtos.json'
const IGNORE_URL = 'https://wht-ml-scraper-default-rtdb.firebaseio.com/whtbase/ignore.json'
const CLASS_PROD_URL = 'https://wht-ml-scraper-default-rtdb.firebaseio.com/whtbase/class_prod.json'

function App() {
  const [classificacoes, setClassificacoes] = useState({})
  const [produtos, setProdutos] = useState({})
  const [abaAtiva, setAbaAtiva] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'valor_parcela', direction: 'asc' })
  const [ultimaData, setUltimaData] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregarDados() {
      try {
        const [classRes, prodRes] = await Promise.all([
          axios.get(CLASS_CONFIG_URL),
          axios.get(PRODUTOS_URL)
        ])

        const raw = classRes.data || {}
        const listaExpandida = {}

        for (const base in raw) {
          if (raw[base].combo_keywords) listaExpandida[`${base} Combo`] = raw[base].combo_keywords
          if (raw[base].sem_combo_keywords) listaExpandida[`${base} Sem Combo`] = raw[base].sem_combo_keywords
        }

        if (!listaExpandida['P1P']) {
          listaExpandida['P1P'] = []
        }

        setClassificacoes(listaExpandida)
        const primeira = Object.keys(listaExpandida)[0]
        setAbaAtiva(primeira)

        const dados = prodRes.data || {}
        const atualizados = Object.fromEntries(
          Object.entries(dados).map(([codigo, p]) => [
            codigo,
            { ...p, valor_parc_real: p.valor_parc_real || '', classificacao: p.classificacao || '' }
          ])
        )
        setProdutos(atualizados)

        const datas = Object.values(atualizados).map((p) => new Date(p.ultima_coleta || 0)).filter(d => d.toString() !== 'Invalid Date')
        const maisRecente = datas.length ? new Date(Math.max(...datas)) : null
        if (maisRecente) {
          const formatado = maisRecente.toLocaleString('pt-BR')
          setUltimaData(formatado)
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        setLoading(false)
      }
    }

    carregarDados()
  }, [])

  const enviarIgnorar = async (codigo) => {
    try {
      await axios.patch(IGNORE_URL, { [codigo]: true })
      setProdutos(prev => {
        const atualizado = { ...prev }
        delete atualizado[codigo]
        return atualizado
      })
      alert(`Produto ${codigo} marcado como ignorado e removido da visualização.`)
    } catch (err) {
      alert('Erro ao enviar para lista de ignorados.')
      console.error(err)
    }
  }

  const enviarClassificacaoManual = async (codigo, classificacao) => {
    try {
      await axios.patch(CLASS_PROD_URL, { [codigo]: classificacao })
      setProdutos(prev => ({
        ...prev,
        [codigo]: {
          ...prev[codigo],
          classificacao
        }
      }))
      alert(`Produto ${codigo} reclassificado para: ${classificacao}`)
    } catch (err) {
      alert('Erro ao atualizar a classificação.')
      console.error(err)
    }
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

      return (
        <tr key={classe} className="border-b text-center">
          <td className="px-2 py-1 font-medium text-left">{classe}</td>
          {[0, 1, 2].map(i => {
            const produto = top3[i]
            if (!produto) return <td key={i} className="px-2 py-1">-</td>

            const valor = produto.valor_parcela
            const link = produto.link
            const destaque = produto.cupom ? 'text-red-600' : 'text-black'

            let descontoInfo = ''
            if (produto.cupom) {
              const match = produto.cupom.match(/(\d{1,3})%/)
              if (match) descontoInfo = ` (${match[1]}%)`
            }

            return (
              <td key={i} className={`px-2 py-1 ${destaque}`}>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  {valor}{descontoInfo}
                </a>
              </td>
            )
          })}
          <td className="px-2 py-1">—</td>
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left">Produto</th>
              <th>Ativo</th>
              <th>Preço</th>
              <th>Parcela</th>
              <th>Real</th>
              <th>18x</th>
              <th>Desconto</th>
              <th>Texto Cupom</th>
              <th>Link</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const destaque = p.cupom ? 'text-red-600' : 'text-black'
              return (
                <tr key={p.codigo} className="border-b">
                  <td className="text-left">{p.produto || '[Sem Título]'}<br /><small>{p.codigo}</small></td>
                  <td>{p.ativo === false ? '❌' : '✅'}</td>
                  <td>{p.preco || '-'}</td>
                  <td className={destaque}>{p.valor_parcela || '-'}</td>
                  <td>{p.valor_parc_real || '-'}</td>
                  <td>{p.parcela_raw?.includes('18x') ? '✅' : '❌'}</td>
                  <td>{p.cupom ? '✅' : '❌'}</td>
                  <td>{p.cupom || '-'}</td>
                  <td><a href={p.link} target="_blank" rel="noopener noreferrer">🔗</a></td>
                  <td>
                    <button onClick={() => enviarIgnorar(p.codigo)} className="mr-2">IGN</button>
                    <select
                      value={p.classificacao}
                      onChange={(e) => enviarClassificacaoManual(p.codigo, e.target.value)}
                      className="text-sm px-1 py-0.5 border rounded"
                    >
                      <option value="">[Selecionar]</option>
                      {Object.keys(classificacoes).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) return <div className="p-5 text-center animate-pulse">Carregando dados...</div>

  return (
    <div className="p-4 font-sans">
      <h1 className="text-xl mb-2">
        Resumo <span className="text-sm text-gray-600">({ultimaData})</span>
      </h1>
      <table className="w-full mb-6 border-collapse text-sm text-center">
        <thead className="bg-gray-200">
          <tr>
            <th>Classe</th>
            <th>Parc1</th>
            <th>Parc2</th>
            <th>Parc3</th>
            <th>Comparativo</th>
          </tr>
        </thead>
        <tbody>{getResumoPorClasse()}</tbody>
      </table>

      <h1 className="text-xl mb-4">Monitor de Produtos</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.keys(classificacoes).map((key) => (
          <button
            key={key}
            onClick={() => {
              setAbaAtiva(key)
              setSortConfig({ key: 'valor_parcela', direction: 'asc' })
            }}
            className={`px-3 py-2 text-base rounded cursor-pointer ${abaAtiva === key ? 'bg-gray-400' : 'bg-gray-300'}`}
          >
            {key}
          </button>
        ))}
      </div>

      {abaAtiva && (
        <div>
          <h2 className="text-lg mb-2">{abaAtiva}</h2>
          {renderProdutos(abaAtiva)}
        </div>
      )}
    </div>
  )
}

export default App
