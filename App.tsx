import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Platform, 
  StatusBar 
} from 'react-native';

// Importamos las pantallas
import { BimestreRegularScreen } from './BimestreRegularScreen';
import { FinAnioScreen } from './FinAñoScreen';
import { FinBimestreScreen } from './FinBimestreScreen';

type Category = 'menu' | 'regular' | 'bimestre' | 'anio';

export default function App() {
  const [currentCategory, setCurrentCategory] = useState<Category>('menu');

  const renderContent = () => {
    switch (currentCategory) {
      case 'regular':
        return <BimestreRegularScreen />;
      case 'bimestre':
        return <FinBimestreScreen />;
      case 'anio':
        return <FinAnioScreen />;
      case 'menu':
      default:
        return <MainMenu setCategory={setCurrentCategory} />;
    }
  };

  return (
    <View style={styles.mainContainer}>
      {/* Barra de Estado para Android */}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* ENCABEZADO SUPERIOR */}
      <View style={styles.header}>
        
        {/* Botón Volver (Posicionado a la izquierda ABSOLUTAMENTE) */}
        {currentCategory !== 'menu' && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setCurrentCategory('menu')}
            activeOpacity={0.6}
            hitSlop={{top: 15, bottom: 15, left: 15, right: 15}} // Facilita el toque
          >
            <Text style={styles.backButtonText}>⬅ Menú</Text>
          </TouchableOpacity>
        )}

        {/* Título (Con márgenes para no chocar) */}
        <Text style={styles.title} numberOfLines={1}>
            CheckApp
        </Text>
      </View>
      
      {/* CONTENIDO DE LA PANTALLA */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

// COMPONENTE DEL MENÚ PRINCIPAL
interface MainMenuProps {
  setCategory: React.Dispatch<React.SetStateAction<Category>>;
}

const MainMenu: React.FC<MainMenuProps> = ({ setCategory }) => (
    <View style={styles.menuContainer}>
        <Text style={styles.welcomeText}>Selecciona una opción:</Text>
        
        <TouchableOpacity style={[styles.menuButton, { backgroundColor: '#4CAF50' }]} onPress={() => setCategory('regular')}>
            <Text style={styles.menuButtonText}>Bimestre Regular</Text>
            <Text style={styles.menuSubtitle}>Seguimiento semanal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuButton, { backgroundColor: '#FFC107' }]} onPress={() => setCategory('bimestre')}>
            <Text style={styles.menuButtonText}>Cierre de Bimestre</Text>
            <Text style={styles.menuSubtitle}>Checklist bimestral</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuButton, { backgroundColor: '#F44336' }]} onPress={() => setCategory('anio')}>
            <Text style={styles.menuButtonText}>Cierre de Año</Text>
            <Text style={styles.menuSubtitle}>Documentación final</Text>
        </TouchableOpacity>
    </View>
);

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#eef1f5',
    // Ajuste de seguridad para el notch/cámara en Android
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    height: 60,
    width: '100%',
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', // Centra el contenido (el título)
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingHorizontal: 10,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    // --- EL ARREGLO MÁGICO ---
    // Esto obliga al título a dejar espacio a los lados, así no se monta sobre el botón
    marginHorizontal: 80, 
  },
  backButton: {
    position: 'absolute', // Flota sobre el header
    left: 10, // Pegado a la izquierda
    height: '100%', // Ocupa toda la altura para centrarse mejor
    justifyContent: 'center',
    zIndex: 20, // Asegura que esté "encima" para poder tocarlo
    paddingHorizontal: 5,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1, 
  },
  
  // Estilos del Menú
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#eef1f5',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  menuButton: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  menuSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
});