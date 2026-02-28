import {
  getPendingPalletizations,
  getPalletizationHistory,
  getLoosePiecesBalances,
} from '@/app/actions/palletization'
import { PaletizacaoClient } from './PaletizacaoClient'

export default async function PaletizacaoPage() {
  const [pendingData, history, loose] = await Promise.all([
    getPendingPalletizations(),
    getPalletizationHistory(),
    getLoosePiecesBalances(),
  ])

  return (
    <PaletizacaoClient
      initialPending={pendingData.items}
      initialMissingRecipe={pendingData.missingRecipe}
      initialHistory={history}
      initialLoose={loose}
    />
  )
}
