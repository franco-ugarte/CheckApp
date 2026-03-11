import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, Switch, Alert, ScrollView } from 'react-native';
import { collection, onSnapshot, doc as firebaseDoc, updateDoc, setDoc } from 'firebase/firestore'; 
import { db } from './firebaseConfig'; 

// --- 1. DEFINICIÓN DE ESTRUCTURA Y TIPOS ---

const BIMESTRE_CHECKLIST = {
    informe_entregado: 'Informe de progreso/notas entregado',
    archivos_revisados: 'Archivos y carpetas pedagógicas revisadas',
    correcciones_aplicadas: 'Correcciones de tareas aplicadas',
    jornada_evaluacion: 'Participación en jornada de evaluación',
};

type BimestreChecks = {
    [K in keyof typeof BIMESTRE_CHECKLIST]: boolean;
};

interface ProfesorFinBimestre {
    id: string;
    nombre: string;
    curso: string;
    // La estructura anidada para los 4 bimestres
    bimestre_1: BimestreChecks;
    bimestre_2: BimestreChecks;
    bimestre_3: BimestreChecks;
    bimestre_4: BimestreChecks;
}

const INITIAL_CHECKS: BimestreChecks = Object.keys(BIMESTRE_CHECKLIST).reduce((acc, key) => {
    acc[key as keyof BimestreChecks] = false;
    return acc;
}, {} as BimestreChecks);

const INITIAL_FIN_BIMESTRE_DATA = {
    bimestre_1: INITIAL_CHECKS,
    bimestre_2: INITIAL_CHECKS,
    bimestre_3: INITIAL_CHECKS,
    bimestre_4: INITIAL_CHECKS,
};

// --- 2. LÓGICA DE ACTUALIZACIÓN ---

const toggleCheck = async (profesorId: string, bimestreKey: keyof ProfesorFinBimestre, checkKey: keyof BimestreChecks, estadoActual: boolean) => {
    try {
        const profesorRef = firebaseDoc(db, 'fin_bimestre', profesorId);
        // Path de la actualización: bimestre_1.informe_entregado
        const fieldPath = `${bimestreKey}.${checkKey}`; 
        
        await updateDoc(profesorRef, {
            [fieldPath]: !estadoActual
        });
    } catch (error) {
        console.error("Error al actualizar check bimestral:", error);
        Alert.alert("Error", "No se pudo actualizar el estado del check.");
    }
};

// --- 3. COMPONENTE AUXILIAR (Bimester View) ---

interface BimestreViewProps {
    profesorId: string;
    bimestreNum: number;
    checks: BimestreChecks;
}

const BimestreView: React.FC<BimestreViewProps> = ({ profesorId, bimestreNum, checks }) => {
    const totalChecks = Object.keys(BIMESTRE_CHECKLIST).length;
    const checksCompletados = Object.values(checks).filter(estado => estado).length;
    const isComplete = checksCompletados === totalChecks;
    
    const bimestreKey = `bimestre_${bimestreNum}` as keyof ProfesorFinBimestre;

    return (
        <View style={[styles.bimestreCard, isComplete ? styles.statusComplete : styles.statusIncomplete]}>
            <Text style={styles.bimestreTitle}>Bimestre {bimestreNum}</Text>
            <Text style={styles.progresoText}>{checksCompletados} de {totalChecks} checks completados</Text>
            
            {Object.entries(BIMESTRE_CHECKLIST).map(([key, label]) => {
                const checkKey = key as keyof BimestreChecks;
                const estado = checks[checkKey];

                return (
                    <View key={key} style={styles.checkItem}>
                        <Text style={styles.checkLabel}>{label}</Text>
                        <Switch
                            value={estado}
                            onValueChange={() => toggleCheck(profesorId, bimestreKey, checkKey, estado)}
                        />
                    </View>
                );
            })}
        </View>
    );
};


// --- 4. RENDER ITEM PRINCIPAL (FlatList) ---

const renderFinBimestreItem = ({ item }: { item: ProfesorFinBimestre }) => {
    return (
        <View style={styles.profesorCard}>
            <View style={styles.profesorHeader}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.curso}>{item.curso}</Text>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bimestreScroll}>
                <BimestreView profesorId={item.id} bimestreNum={1} checks={item.bimestre_1} />
                <BimestreView profesorId={item.id} bimestreNum={2} checks={item.bimestre_2} />
                <BimestreView profesorId={item.id} bimestreNum={3} checks={item.bimestre_3} />
                <BimestreView profesorId={item.id} bimestreNum={4} checks={item.bimestre_4} />
            </ScrollView>
        </View>
    );
};

// --- 5. COMPONENTE PRINCIPAL DE LA PANTALLA ---

export const FinBimestreScreen: React.FC = () => {
    const [profesoresData, setProfesoresData] = useState<ProfesorFinBimestre[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Obtenemos nombres base de la colección 'profesores'
        const baseProfCollection = collection(db, 'profesores');
        const finBimestreCollection = collection(db, 'fin_bimestre');

        const unsubscribeBase = onSnapshot(baseProfCollection, (baseSnapshot) => {
            const baseProfMap = new Map<string, { nombre: string, curso: string }>();
            baseSnapshot.docs.forEach(doc => {
                const data = doc.data() as { nombre: string, curso: string };
                baseProfMap.set(doc.id, { nombre: data.nombre, curso: data.curso });
            });

            // Obtenemos los datos de seguimiento de la colección 'fin_bimestre'
            const unsubscribeFinBimestre = onSnapshot(finBimestreCollection, async (finBimestreSnapshot) => {
                const batchUpdates: Promise<void>[] = [];
                const listaFinal: ProfesorFinBimestre[] = [];

                for (const [id, baseData] of baseProfMap.entries()) {
                    const finBimestreDoc = finBimestreSnapshot.docs.find(d => d.id === id);
                    const profesorRef = firebaseDoc(db, 'fin_bimestre', id);

                    let dataChecks: typeof INITIAL_FIN_BIMESTRE_DATA;

                    if (finBimestreDoc) {
                        dataChecks = finBimestreDoc.data() as typeof INITIAL_FIN_BIMESTRE_DATA;
                        
                        // Respaldo: Si el documento existe pero le falta la estructura completa
                        let needsUpdate = false;
                        if (!dataChecks.bimestre_1) { dataChecks.bimestre_1 = INITIAL_CHECKS; needsUpdate = true; }
                        if (!dataChecks.bimestre_2) { dataChecks.bimestre_2 = INITIAL_CHECKS; needsUpdate = true; }
                        // etc... (simplificado, pero en producción se chequearían todos)
                        
                        if (needsUpdate) {
                           batchUpdates.push(updateDoc(profesorRef, dataChecks));
                        }

                    } else {
                        // Si NO existe, creamos la entrada con la estructura inicial
                        dataChecks = INITIAL_FIN_BIMESTRE_DATA;
                        batchUpdates.push(setDoc(profesorRef, { 
                            nombre: baseData.nombre, 
                            curso: baseData.curso, 
                            ...INITIAL_FIN_BIMESTRE_DATA 
                        }));
                    }
                    
                    listaFinal.push({
                        id: id,
                        nombre: baseData.nombre,
                        curso: baseData.curso,
                        ...dataChecks
                    } as ProfesorFinBimestre);
                }
                
                await Promise.all(batchUpdates);
                
                setProfesoresData(listaFinal.sort((a, b) => a.nombre.localeCompare(b.nombre)));
                setLoading(false);
            });
            
            return () => unsubscribeFinBimestre();
        });

        return () => unsubscribeBase();
    }, []);

    if (loading) {
        return <View style={styles.loadingContainer}><Text style={styles.loadingText}>Cargando Reportes Bimestrales...</Text></View>;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Checklist de Cierre Bimestral</Text>
            <Text style={styles.subtitle}>Seguimiento de 4 puntos clave por cada bimestre.</Text>
            <FlatList
                data={profesoresData}
                renderItem={renderFinBimestreItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
};


// --- 6. ESTILOS ---

const styles = StyleSheet.create({
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { fontSize: 18, color: '#555' },
    container: { flex: 1, backgroundColor: '#f0f4f7', padding: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginVertical: 10, color: '#FFC107' },
    subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 15, color: '#666' },
    listContent: { paddingBottom: 20 },
    
    // Tarjeta del Profesor
    profesorCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginVertical: 8,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    profesorHeader: { marginBottom: 10, borderBottomColor: '#eee', paddingBottom: 10 },
    nombre: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
    curso: { fontSize: 15, color: '#666', marginTop: 2 },
    
    // Contenedor de Bimestre (Scroll Horizontal)
    bimestreScroll: {
        flexDirection: 'row',
        paddingVertical: 5,
        maxHeight: 250, // Limita la altura para el scroll
    },
    bimestreCard: {
        width: 280, // Ancho fijo para las tarjetas bimestrales
        marginRight: 10,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    bimestreTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
        color: '#333',
    },
    progresoText: {
        fontSize: 13,
        color: '#666',
        marginBottom: 8,
    },
    
    // Estilos de Estado
    statusComplete: {
        backgroundColor: '#e6ffe6',
        borderColor: '#4CAF50', // Verde
    },
    statusIncomplete: {
        backgroundColor: '#fff8e1',
        borderColor: '#FFC107', // Amarillo
    },
    
    // Item del Check
    checkItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    checkLabel: {
        flex: 1,
        fontSize: 13,
        color: '#333',
        paddingRight: 10,
    },
});