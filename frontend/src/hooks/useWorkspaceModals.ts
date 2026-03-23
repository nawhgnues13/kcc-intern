import { useState } from "react";
import { Attachment } from "../types/attachment";
import { generateImageMock } from "../services/mock/generationMock";

export function useWorkspaceModals() {
  // Modals state
  const [previewItem, setPreviewItem] = useState<Attachment | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showImageReplaceModal, setShowImageReplaceModal] = useState(false);
  
  // Image generation/replacement state
  const [heroImage, setHeroImage] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleImageReplace = () => {
    setShowImageReplaceModal(true);
  };

  const handleGenerateNewImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    
    const newImageUrl = await generateImageMock(imagePrompt);
    
    setHeroImage(newImageUrl);
    setIsGeneratingImage(false);
    setShowImageReplaceModal(false);
    setImagePrompt("");
  };

  const handleUploadNewImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsGeneratingImage(true);
      setTimeout(() => {
        setHeroImage("https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080");
        setIsGeneratingImage(false);
        setShowImageReplaceModal(false);
      }, 1000);
    }
  };

  return {
    previewItem,
    setPreviewItem,
    itemToDelete,
    setItemToDelete,
    showEmailModal,
    setShowEmailModal,
    showImageReplaceModal,
    setShowImageReplaceModal,
    heroImage,
    setHeroImage,
    imagePrompt,
    setImagePrompt,
    isGeneratingImage,
    handleImageReplace,
    handleGenerateNewImage,
    handleUploadNewImage
  };
}
