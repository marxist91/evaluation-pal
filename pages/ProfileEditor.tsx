
import React, { useState } from 'react';
import { editProfileImage } from '../services/geminiService';
import { User } from '../types';
import { useToast } from '../context/ToastContext';

const ProfileEditor = ({ user }: { user: User }) => {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(user.avatarUrl || null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!image || !prompt) return;
    setLoading(true); 
    try {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];
      const newImage = await editProfileImage(base64Data, prompt, mimeType);
      setImage(newImage);
      showToast("Transformation IA réussie !", "success");
    } catch (err) { 
        showToast("Erreur lors de la génération. Veuillez réessayer.", "error"); 
        console.error(err); 
    } finally { 
        setLoading(false); 
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
       <h2 className="text-2xl font-bold text-gray-800 mb-6">Éditeur de Photo IA</h2>
       <div className="bg-white p-8 rounded-lg shadow">
         <div className="flex flex-col items-center mb-8">
           <div className="w-64 h-64 bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center relative group">
             {image ? (
                <img src={image} alt="Profile" className="w-full h-full object-cover" />
             ) : (
                <div className="text-center p-4 text-gray-400">
                    <i className="fas fa-camera text-3xl mb-2"></i>
                    <p>Cliquez pour ajouter une photo</p>
                </div>
             )}
             <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
             <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition flex items-center justify-center">
                <span className="text-white opacity-0 group-hover:opacity-100 font-bold">Changer l'image</span>
             </div>
           </div>
         </div>

         <div className="space-y-4">
           <label className="block text-sm font-medium text-gray-700">Instruction pour l'IA (Gemini)</label>
           <div className="flex gap-2">
             <input 
                type="text" 
                className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-pal-500 outline-none" 
                placeholder="Ex: Ajouter un fond de bureau professionnel bleu, rendre le sourire plus éclatant..." 
                value={prompt} 
                onChange={e => setPrompt(e.target.value)} 
             />
             <button 
                onClick={handleGenerate} 
                disabled={!image || !prompt || loading} 
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-bold flex items-center transition shadow-md"
             >
                {loading ? (
                    <><i className="fas fa-spinner fa-spin mr-2"></i> Traitement...</>
                ) : (
                    <><i className="fas fa-wand-magic-sparkles mr-2"></i> Générer</>
                )}
             </button>
           </div>
           
           <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm mt-4">
               <i className="fas fa-info-circle mr-2"></i>
               Astuce : Utilisez des descriptions précises pour obtenir de meilleurs résultats. L'IA conservera votre visage tout en modifiant l'environnement ou le style selon votre demande.
           </div>
         </div>
       </div>
    </div>
  );
}

export default ProfileEditor;
