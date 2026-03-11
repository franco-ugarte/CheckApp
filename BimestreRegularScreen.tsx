import React, { useState, useEffect, useMemo } from 'react';
import { 
    StyleSheet, 
    Text, 
    View, 
    FlatList, 
    ScrollView, 
    TouchableOpacity,
    TextInput,
    Alert 
} from 'react-native';
import { db } from './firebaseConfig'; 
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore'; 

// --- 1. DEFINICIÓN DE TIPOS ---

type BimestreChecks = { [key: string]: boolean };

interface Profesor {
    id: string;
    nombre: string;
    curso: string;
    rol: 'docente' | 'auxiliar';
    cant_sesiones: number; 
    cant_tutorias: number; 
    bimestre_1?: BimestreChecks;
    bimestre_2?: BimestreChecks;
    bimestre_3?: BimestreChecks;
    bimestre_4?: BimestreChecks;
}

const INITIAL_CHECKS: BimestreChecks = {};

const INITIAL_PROFESOR_DATA = {
    bimestre_1: INITIAL_CHECKS,
    bimestre_2: INITIAL_CHECKS,
    bimestre_3: INITIAL_CHECKS,
    bimestre_4: INITIAL_CHECKS,
};

// --- 2. FUNCIONES DE FIRESTORE ---

const toggleSubCheck = async (profesorId: string, bimestre: keyof Profesor, key: string, estadoActual: boolean) => {
    if (typeof bimestre !== 'string' || !bimestre.startsWith('bimestre_')) return;
    const profesorRef = doc(db, 'profesores', profesorId);
    const fieldPath = `${bimestre}.${key}`; 
    await updateDoc(profesorRef, { [fieldPath]: !estadoActual });
};

const createProfesor = async (
    nombre: string, 
    curso: string, 
    rol: 'docente' | 'auxiliar',
    sesiones: string,
    tutorias: string
) => {
    if (!nombre || !curso) {
        Alert.alert("Error", "El nombre y el curso son obligatorios.");
        return false;
    }
    
    const numSesiones = parseInt(sesiones) || 0;
    const numTutorias = parseInt(tutorias) || 0;

    if (numSesiones < 1 && numTutorias < 1) {
        Alert.alert("Error", "Debe tener al menos 1 sesión o 1 tutoría.");
        return false;
    }

    try {
        const newProfesor = {
            nombre,
            curso,
            rol,
            cant_sesiones: numSesiones,
            cant_tutorias: numTutorias,
            ...INITIAL_PROFESOR_DATA
        };
        await addDoc(collection(db, 'profesores'), newProfesor);
        Alert.alert("Éxito", "Personal añadido correctamente.");
        return true;
    } catch (error) {
        console.error("Error al añadir:", error);
        Alert.alert("Error", "No se pudo guardar.");
        return false;
    }
};

const deleteProfesor = async (id: string, nombre: string) => {
    Alert.alert(
        "Eliminar Personal",
        `¿Eliminar a ${nombre}?`,
        [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", style: "destructive", onPress: async () => {
                try { await deleteDoc(doc(db, 'profesores', id)); } catch (e) { Alert.alert("Error", "No se pudo eliminar."); }
            }}
        ]
    );
};

// --- 3. COMPONENTE DE FORMULARIO (Sin cambios en lógica) ---

interface AddProfesorFormProps { onProfesorAdded: () => void; }

const AddProfesorForm: React.FC<AddProfesorFormProps> = ({ onProfesorAdded }) => {
    const [nombre, setNombre] = useState('');
    const [curso, setCurso] = useState('');
    const [rol, setRol] = useState<'docente' | 'auxiliar'>('docente');
    const [sesiones, setSesiones] = useState('1'); 
    const [tutorias, setTutorias] = useState('0'); 
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async () => {
        setIsSaving(true);
        const success = await createProfesor(nombre, curso, rol, sesiones, tutorias);
        setIsSaving(false);
        if (success) {
            setNombre(''); setCurso(''); onProfesorAdded(); 
        }
    };

    return (
        <ScrollView style={styles.formContainer}>
            <Text style={styles.formTitle}>Añadir Nuevo Personal</Text>
            
            <View style={styles.rolSelector}>
                <TouchableOpacity style={[styles.rolButton, rol === 'docente' && styles.rolButtonActive]} onPress={() => setRol('docente')}>
                    <Text style={[styles.rolText, rol === 'docente' && styles.rolTextActive]}>Docente</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rolButton, rol === 'auxiliar' && styles.rolButtonActive]} onPress={() => setRol('auxiliar')}>
                    <Text style={[styles.rolText, rol === 'auxiliar' && styles.rolTextActive]}>Auxiliar</Text>
                </TouchableOpacity>
            </View>

            <TextInput style={styles.input} placeholder="Nombre y Apellidos" value={nombre} onChangeText={setNombre} />
            <TextInput style={styles.input} placeholder={rol === 'docente' ? "Curso" : "Cargo"} value={curso} onChangeText={setCurso} />

            <View style={styles.rowInputs}>
                <View style={{flex: 1, marginRight: 10}}>
                    <Text style={styles.label}>N° Sesiones/Sem:</Text>
                    <TextInput 
                        style={styles.input} 
                        value={sesiones} 
                        onChangeText={setSesiones} 
                        keyboardType="numeric" 
                        maxLength={1}
                    />
                </View>
                <View style={{flex: 1}}>
                    <Text style={styles.label}>N° Tutorías/Sem:</Text>
                    <TextInput 
                        style={styles.input} 
                        value={tutorias} 
                        onChangeText={setTutorias} 
                        keyboardType="numeric"
                        maxLength={1}
                    />
                </View>
            </View>

            <TouchableOpacity style={[styles.button, isSaving && styles.buttonDisabled]} onPress={handleSubmit} disabled={isSaving}>
                <Text style={styles.buttonText}>{isSaving ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onProfesorAdded} disabled={isSaving}>
                <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

// --- 4. COMPONENTE TRACKER SEMANAL (NUEVA LÓGICA) ---

interface WeeklyTrackerProps {
    profesorId: string;
    bimestreNum: number;
    checks: BimestreChecks;
    numSesiones: number;
    numTutorias: number;
}

const WeeklyTracker: React.FC<WeeklyTrackerProps> = ({ profesorId, bimestreNum, checks, numSesiones, numTutorias }) => {
    
    // --- Lógica del Acordeón ---
    const [isExpanded, setIsExpanded] = useState(false);
    
    // --- Lógica de Completado ---
    const weeks = [1, 2, 3, 4, 5, 6, 7, 8];
    const expectedChecksPerWeek = numSesiones + numTutorias;
    
    // Función para verificar si un bimestre está completo
    const isBimesterComplete = useMemo(() => {
        if (expectedChecksPerWeek === 0) return true; // Si no hay nada que entregar
        
        let completed = true;
        for (let week = 1; week <= 8; week++) {
            // Verificar Sesiones
            for (let i = 1; i <= numSesiones; i++) {
                if (!checks[`w${week}_s${i}`]) {
                    completed = false;
                    break;
                }
            }
            if (!completed) break;
            
            // Verificar Tutorías
            for (let i = 1; i <= numTutorias; i++) {
                if (!checks[`w${week}_t${i}`]) {
                    completed = false;
                    break;
                }
            }
            if (!completed) break;
        }
        return completed;
    }, [checks, numSesiones, numTutorias]);

    const bimestreKey = `bimestre_${bimestreNum}` as keyof Profesor;
    const bimColorStyle = isBimesterComplete ? styles.bimestreComplete : styles.bimestreIncomplete;

    return (
        <View style={[styles.bimestreCard, bimColorStyle, { width: isExpanded ? 300 : 212 }]}> 
            
            {/* CABECERA PLEGABLE */}
            <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.bimestreHeader}>
                <Text style={styles.bimestreTitle}>Bimestre {bimestreNum}</Text>
                
                {/* ARREGLO 2: Quitamos el punto suspensivo y reducimos la fuente */}
                <Text style={[styles.progressText, { fontSize: 11, marginLeft: 5 }]}> 
                    {isBimesterComplete ? '✅ Completo' : '...Pendiente'}
                </Text>
            </TouchableOpacity>
            
            {/* CONTENIDO DESPLEGABLE */}
            {isExpanded && (
                <View style={styles.weeksContainer}>
                    {weeks.map((week) => (
                        <View key={week} style={styles.weekRow}>
                            <Text style={styles.weekLabel}>Sem. {week}</Text>
                            <View style={styles.buttonsRow}>
                                {/* Renderizar SESIONES (S1, S2...) */}
                                {Array.from({ length: numSesiones }).map((_, i) => {
                                    const key = `w${week}_s${i+1}`; 
                                    const isActive = checks?.[key] || false;
                                    return (
                                        <TouchableOpacity 
                                            key={key}
                                            style={[styles.checkBubble, isActive ? styles.bubbleSesion : styles.bubbleInactive]}
                                            onPress={() => toggleSubCheck(profesorId, bimestreKey, key, isActive)}
                                        >
                                            <Text style={[styles.bubbleText, isActive && styles.bubbleTextActive]}>S{i+1}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                                
                                {/* Renderizar TUTORÍAS (T1...) */}
                                {numTutorias > 0 && Array.from({ length: numTutorias }).map((_, i) => {
                                    const key = `w${week}_t${i+1}`; 
                                    const isActive = checks?.[key] || false;
                                    return (
                                        <TouchableOpacity 
                                            key={key}
                                            style={[styles.checkBubble, isActive ? styles.bubbleTutoria : styles.bubbleInactive]}
                                            onPress={() => toggleSubCheck(profesorId, bimestreKey, key, isActive)}
                                        >
                                            <Text style={[styles.bubbleText, isActive && styles.bubbleTextActive]}>T{i+1}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};


// --- 5. RENDER ITEM PRINCIPAL ---
const renderProfesorItem = ({ item }: { item: Profesor }) => (
    <View style={styles.profesorCard}>
        <View style={styles.profesorHeaderRow}>
            <View style={{flex: 1}}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.curso}>
                    {item.rol === 'auxiliar' ? '' : ''} {item.curso} 
                    <Text style={styles.detailsText}> • {item.cant_sesiones} Ses. / {item.cant_tutorias} Tut.</Text>
                </Text>
            </View>
            <TouchableOpacity onPress={() => deleteProfesor(item.id, item.nombre)} style={styles.deleteButton}>
                <Text style={styles.deleteIcon}>X</Text>
            </TouchableOpacity>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bimestreScroll}>
            {[1, 2, 3, 4].map(num => (
                <WeeklyTracker 
                    key={num}
                    profesorId={item.id} 
                    bimestreNum={num} 
                    checks={(item as any)[`bimestre_${num}`] || {}}
                    numSesiones={item.cant_sesiones || 1}
                    numTutorias={item.cant_tutorias || 0}
                />
            ))}
        </ScrollView>
    </View>
);

// --- 6. PANTALLA PRINCIPAL (Sin cambios en lógica) ---
export const BimestreRegularScreen: React.FC = () => {
    const [profesores, setProfesores] = useState<Profesor[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'add'>('list');
    const [searchTerm, setSearchTerm] = useState(''); 

    useEffect(() => {
        const profCollection = collection(db, 'profesores');
        const unsubscribe = onSnapshot(profCollection, (snapshot) => {
            const batchUpdates: Promise<void>[] = []; 
            const listaProfesores = snapshot.docs.map(document => { 
                const data = document.data() as Partial<Profesor>;
                let needsUpdate = false;
                let updateFields: any = {};

                // Migración para datos antiguos
                if (!data.rol) { needsUpdate = true; updateFields.rol = 'docente'; data.rol = 'docente'; }
                if (data.cant_sesiones === undefined) { needsUpdate = true; updateFields.cant_sesiones = 1; data.cant_sesiones = 1; }
                if (data.cant_tutorias === undefined) { needsUpdate = true; updateFields.cant_tutorias = 0; data.cant_tutorias = 0; }
                if (!data.bimestre_1) { needsUpdate = true; updateFields.bimestre_1 = {}; }

                if (needsUpdate) {
                    batchUpdates.push(updateDoc(doc(db, 'profesores', document.id), updateFields));
                }
                
                return {
                    id: document.id, 
                    nombre: data.nombre,
                    curso: data.curso,
                    rol: data.rol,
                    cant_sesiones: data.cant_sesiones,
                    cant_tutorias: data.cant_tutorias,
                    bimestre_1: data.bimestre_1 || {},
                    bimestre_2: data.bimestre_2 || {},
                    bimestre_3: data.bimestre_3 || {},
                    bimestre_4: data.bimestre_4 || {},
                } as Profesor;
            });
            Promise.all(batchUpdates);
            setProfesores(listaProfesores);
            setLoading(false);
        });
        return () => unsubscribe(); 
    }, []); 

    const filteredProfesores = useMemo(() => {
        if (!searchTerm) return profesores;
        const lower = searchTerm.toLowerCase();
        return profesores.filter(p => p.nombre.toLowerCase().includes(lower) || p.curso.toLowerCase().includes(lower));
    }, [profesores, searchTerm]);

    if (loading) return <View style={styles.loadingContainer}><Text>Cargando...</Text></View>;

    if (view === 'add') {
        return (
            <View style={styles.formScreenContainer}>
                <AddProfesorForm onProfesorAdded={() => setView('list')} />
            </View>
        );
    }

    return (
        <View style={styles.fullContentContainer}> 
            <TextInput style={styles.searchBar} placeholder="Buscar..." value={searchTerm} onChangeText={setSearchTerm} />
            <TouchableOpacity style={styles.addButton} onPress={() => setView('add')}>
                <Text style={styles.addButtonText}>+ Añadir Personal</Text>
            </TouchableOpacity>

            <FlatList
                data={filteredProfesores}
                renderItem={renderProfesorItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={<Text style={styles.noResultsText}>No hay resultados.</Text>}
            />
        </View>
    );
}

// --- 7. ESTILOS ---
const styles = StyleSheet.create({
    fullContentContainer: { flex: 1, backgroundColor: '#eef1f5' },
    formScreenContainer: { flex: 1, backgroundColor: '#eef1f5', paddingHorizontal: 15, paddingTop: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef1f5' },
    searchBar: { borderWidth: 1, borderColor: '#ddd', padding: 12, marginHorizontal: 15, marginTop: 10, marginBottom: 5, borderRadius: 8, backgroundColor: '#fff', fontSize: 16 },
    noResultsText: { textAlign: 'center', marginTop: 30, fontSize: 16, color: '#888' },
    
    // Tarjeta
    profesorCard: { backgroundColor: '#fff', borderRadius: 10, marginVertical: 8, marginHorizontal: 15, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    profesorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    nombre: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
    curso: { fontSize: 16, color: '#333', marginTop: 2 },
    detailsText: { fontSize: 13, color: '#666', fontWeight: 'normal' },
    deleteButton: { padding: 10 },
    deleteIcon: { fontSize: 22 },

   // Scroll de Bimestres
    bimestreScroll: { flexDirection: 'row', paddingBottom: 5 },
    
    // Tarjeta de Bimestre (AJUSTADO)
    bimestreCard: { 
        borderRadius: 8, 
        borderWidth: 1, 
        borderColor: '#ddd', 
        marginRight: 10, 
        padding: 10,
        // Eliminamos el width fijo de aquí, se maneja en el componente
    },
    bimestreHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 5,
    },
    bimestreComplete: { backgroundColor: '#e6ffe6', borderColor: '#4CAF50' }, // Verde suave
    bimestreIncomplete: { backgroundColor: '#f9f9f9', borderColor: '#ccc' }, // Gris/Blanco
    
    bimestreTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    
    // ESTILO DE PROGRESO (AJUSTADO)
    progressText: { 
        fontSize: 11, // Se reduce el tamaño aquí, aunque ya lo ajustamos arriba
        marginLeft: 5, 
        fontWeight: '600', 
        color: '#4CAF50' 
    },
    expandIconBimestre: { fontSize: 14, color: '#999', marginLeft: 5 },


    // Estilos de Semanas
    weeksContainer: { marginTop: 10 },
    weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
    weekLabel: { width: 45, fontSize: 14, fontWeight: 'bold', color: '#555' },
    buttonsRow: { flexDirection: 'row', flex: 1, flexWrap: 'wrap' },
    
    // Botones de Check (Burbujas)
    checkBubble: {
        width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 5, marginBottom: 2,
        borderWidth: 1,
    },
    bubbleInactive: { backgroundColor: '#fff', borderColor: '#ccc' },
    bubbleSesion: { backgroundColor: '#4CAF50', borderColor: '#388E3C' },
    bubbleTutoria: { backgroundColor: '#2196F3', borderColor: '#1976D2' },
    
    bubbleText: { fontSize: 10, fontWeight: 'bold', color: '#666' },
    bubbleTextActive: { color: '#fff' },

    // Formulario
    addButton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginHorizontal: 15, marginVertical: 10, alignItems: 'center' },
    addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    formContainer: { flex: 1 },
    formTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 15, borderRadius: 8, fontSize: 16, backgroundColor: '#fff' },
    rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    label: { fontSize: 14, marginBottom: 5, fontWeight: '600', color: '#444' },
    button: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
    cancelButton: { backgroundColor: '#ccc' },
    buttonDisabled: { backgroundColor: '#a5d6a7' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },

    rolSelector: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    rolButton: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#007AFF', alignItems: 'center', marginHorizontal: 5, borderRadius: 8 },
    rolButtonActive: { backgroundColor: '#007AFF' },
    rolText: { color: '#007AFF', fontWeight: 'bold' },
    rolTextActive: { color: '#fff' },
});