import { useEffect } from 'react'
import { initStore } from './store'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import TaskGrid from './components/TaskGrid'
import InputBar from './components/InputBar'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import MaskEditorModal from './components/MaskEditorModal'
import ImageContextMenu from './components/ImageContextMenu'
import PromptLibraryModal from './components/PromptLibraryModal'
import ImageUrlImportModal from './components/ImageUrlImportModal'
import ApiKeyModal from './components/ApiKeyModal'
import OnboardingModal from './components/OnboardingModal'
import OnboardingCoachmark from './components/OnboardingCoachmark'

export default function App() {
  useEffect(() => {
    initStore()
  }, [])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  return (
    <>
      <Header />
      <main data-home-main data-drag-select-surface className="pb-48">
        <div className="safe-area-x max-w-7xl mx-auto">
          <SearchBar />
          <TaskGrid />
        </div>
      </main>
      <InputBar />
      <DetailModal />
      <Lightbox />
      <SettingsModal />
      <ConfirmDialog />
      <Toast />
      <MaskEditorModal />
      <ImageContextMenu />
      <PromptLibraryModal />
      <ImageUrlImportModal />
      <ApiKeyModal />
      <OnboardingModal />
      <OnboardingCoachmark />
    </>
  )
}
