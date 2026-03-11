import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    StyleSheet, Text, View, FlatList, Switch, Alert, TouchableOpacity, TextInput, ActivityIndicator 
} from 'react-native';

// --- 1. IMPORTS DE LIBRERÍAS (SIEMPRE ARRIBA) ---
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

// --- FIREBASE ---
import { collection, onSnapshot, doc as firebaseDoc, updateDoc, setDoc } from 'firebase/firestore'; 
import { db } from './firebaseConfig'; 

// --- 2. DEFINICIÓN DE DOCUMENTOS ---
const DOCUMENTOS_DOCENTE = {
    informe_refuerzo: '1. Informe de Refuerzo escolar',
    eval_recuperacion: '2. Relación de estudiantes Recup.',
    plan_mejora_2026: '3. Plan de mejora 2026',
    informe_tutoria: '4. Informe Anual de Tutoría',
    informe_tecnico_pedag: '5. Informe Técnico pedagógico',
    informe_comisiones: '6. Informe de Comisiones',
    cartel_necesidades: '7. Cartel de necesidades',
    programacion_anual_2026: '8. Programación Anual 2026',
    primera_unidad_2026: '9. Primera Unidad de Aprendizaje',
    informe_taller_lab: '10. Informe de taller/lab',
    informe_psicopedagogico: '11. Informe Psicopedagógico',
    registro_siagie: '12. Registro de Evaluación (Físico)',
    temario_recuperacion: '13. Temario de Recuperación',
    examen_recuperacion: '14. Examen de Recuperación',
    solucionario_recuperacion: '15. Solucionario de Recuperación',
    informe_pip: '16. Informe del PIP',
    datos_personales: '17. Datos Personales Actualizados',
};

const DOCUMENTOS_AUXILIAR = {
    asistencia_siagie: 'a. Registro de Asistencia SIAGIE (Mes)',
    acciones_nee: 'b. Acciones estudiantes NEE',
    informe_conductual: 'c. Informe Conductual Anual',
    informe_riesgo: 'd. Informe estudiantes en riesgo',
    datos_personales: 'e. Datos Personales Actualizados',
};

// --- TIPOS ---
type DocumentosMixtos = any; 

interface ProfesorFinAnio {
    id: string;
    nombre: string;
    curso: string;
    rol: 'docente' | 'auxiliar'; 
    documentos: DocumentosMixtos;
    isExpanded: boolean;
}

const INITIAL_DOCS_DOCENTE = Object.keys(DOCUMENTOS_DOCENTE).reduce((acc: any, key) => {
    acc[key] = false; return acc;
}, {});

const INITIAL_DOCS_AUXILIAR = Object.keys(DOCUMENTOS_AUXILIAR).reduce((acc: any, key) => {
    acc[key] = false; return acc;
}, {});

// --- 3. LÓGICA DE ACTUALIZACIÓN FIREBASE ---
const toggleDocumento = async (profesorId: string, docKey: string, estadoActual: boolean) => {
    try {
        const profesorRef = firebaseDoc(db, 'fin_anio', profesorId);
        const fieldPath = `documentos.${docKey}`; 
        await updateDoc(profesorRef, { [fieldPath]: !estadoActual });
    } catch (error) {
        console.error("Error al actualizar:", error);
    }
};

// --- 4. COMPONENTE DE CADA PROFESOR (ITEM) ---
const RenderFinAnioItem: React.FC<{ item: ProfesorFinAnio; onToggleExpand: (id: string) => void; }> = ({ item, onToggleExpand }) => { 
    const isAuxiliar = item.rol === 'auxiliar';
    const LISTA_DOCUMENTOS = isAuxiliar ? DOCUMENTOS_AUXILIAR : DOCUMENTOS_DOCENTE;
    const total = Object.keys(LISTA_DOCUMENTOS).length;
    const completados = Object.keys(LISTA_DOCUMENTOS).filter(key => item.documentos[key] === true).length;
    const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;
    const isComplete = completados === total && total > 0;
    const cardRef = useRef<View>(null);

    const handleDownloadImage = async () => {
        if (!item.isExpanded) { Alert.alert("Atención", "Abre la tarjeta primero."); return; }
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') return;
            if (cardRef.current) {
                await new Promise(resolve => setTimeout(resolve, 100));
                const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
                await MediaLibrary.saveToLibraryAsync(uri);
                Alert.alert("Guardado", "Imagen guardada en tu galería.");
            }
        } catch (e) { console.error(e); }
    };

    return (
        <View ref={cardRef} collapsable={false} style={styles.profesorCardWrapper}> 
            <View style={styles.profesorCard}>
                <TouchableOpacity onPress={() => onToggleExpand(item.id)} activeOpacity={0.7}>
                    <View style={styles.headerTopRow}>
                        <View style={styles.headerInfo}>
                            <Text style={styles.nombre}>{item.nombre}</Text>
                            <Text style={styles.curso}>{isAuxiliar ? 'Auxiliar' : 'Docente'} - {item.curso}</Text>
                        </View>
                        <TouchableOpacity onPress={handleDownloadImage} style={styles.downloadButton}>
                            <Text style={{fontSize: 22}}>📸</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.progressRow}>
                        <Text style={[styles.progresoText, { color: isComplete ? '#28a745' : '#007AFF' }]}>
                            {completados}/{total} ({porcentaje}%)
                        </Text>
                        <Text style={styles.expandIcon}>{item.isExpanded ? '▲' : '▼'}</Text>
                    </View>
                </TouchableOpacity>
                {item.isExpanded && (
                    <View style={[styles.statusContainer, isComplete ? styles.statusComplete : styles.statusIncomplete]}>
                        <Text style={styles.statusTitle}>{isAuxiliar ? 'Checklist Auxiliar' : 'Checklist Fin de Año'}</Text>
                        {Object.entries(LISTA_DOCUMENTOS).map(([key, label]) => {
                            const est = item.documentos[key] || false;
                            return (
                                <View key={key} style={[styles.documentoItem, est && styles.documentoItemActive]}>
                                    <Text style={styles.documentoLabel}>{label}</Text>
                                    <Switch 
                                        value={est} 
                                        onValueChange={() => toggleDocumento(item.id, key, est)} 
                                        trackColor={{ false: "#767577", true: "#81b0ff" }} 
                                        thumbColor={est ? "#007AFF" : "#f4f3f4"} 
                                    />
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        </View>
    );
};

// --- 5. PANTALLA PRINCIPAL ---
export const FinAnioScreen: React.FC = () => {
    const [data, setData] = useState<ProfesorFinAnio[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const exportarExcel = async () => {
    if (!data || data.length === 0) {
        Alert.alert("Sin datos", "No hay información para exportar.");
        return;
    }

    try {
        // 1. Preparar filas
        const rows = data.map(user => {
            const isAux = user.rol === 'auxiliar';
            const listaDocs = isAux ? DOCUMENTOS_AUXILIAR : DOCUMENTOS_DOCENTE;
            const row: any = { 'Nombre': user.nombre, 'Rol': user.rol.toUpperCase(), 'Curso': user.curso };
            Object.entries(listaDocs).forEach(([key, label]) => {
                // @ts-ignore
                row[label] = user.documentos[key] ? '✅' : '❌';
            });
            return row;
        });

        // 2. Crear Excel
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        
        // 3. Definir Ruta (Usando la API legacy que acabamos de importar)
        const dir = FileSystem.cacheDirectory;
        const uri = dir + `Reporte_CheckApp_${Date.now()}.xlsx`;

        // 4. Escribir archivo
        await FileSystem.writeAsStringAsync(uri, wbout, { 
            encoding: 'base64' 
        });
        
        // 5. Compartir
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Reporte de Excel',
            });
        }
    } catch (e: any) { 
        console.error(e); 
        Alert.alert("Error Técnico", "No se pudo generar: " + e.message); 
    }
};

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'profesores'), (baseSnap) => {
            const baseMap = new Map();
            baseSnap.docs.forEach(d => baseMap.set(d.id, d.data()));
            
            const unsub2 = onSnapshot(collection(db, 'fin_anio'), async (finSnap) => {
                const list: ProfesorFinAnio[] = [];
                const updates: Promise<void>[] = [];
                
                for (const [id, base] of baseMap.entries()) {
                    const finDoc = finSnap.docs.find(d => d.id === id);
                    const rol = base.rol || 'docente';
                    const init = rol === 'auxiliar' ? INITIAL_DOCS_AUXILIAR : INITIAL_DOCS_DOCENTE;
                    let docs = init;

                    if (finDoc) { 
                        docs = { ...init, ...finDoc.data().documentos }; 
                    } else { 
                        updates.push(setDoc(firebaseDoc(db, 'fin_anio', id), { ...base, rol, documentos: init })); 
                    }

                    list.push({ id, nombre: base.nombre, curso: base.curso, rol, documentos: docs, isExpanded: false });
                }

                if (updates.length) await Promise.all(updates);
                
                setData(prev => {
                    const expanded = new Set(prev.filter(p => p.isExpanded).map(p => p.id));
                    return list.map(p => ({ ...p, isExpanded: expanded.has(p.id) }))
                               .sort((a, b) => a.nombre.localeCompare(b.nombre));
                });
                setLoading(false);
            });
            return () => unsub2();
        });
        return () => unsub();
    }, []);

    const filtered = useMemo(() => data.filter(p => 
        p.nombre.toLowerCase().includes(search.toLowerCase()) || 
        p.curso.toLowerCase().includes(search.toLowerCase())
    ), [data, search]);

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#DC3545" /></View>;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Documentación de Cierre Anual</Text>
            
            <TouchableOpacity style={styles.btnExcel} onPress={exportarExcel}>
                <Text style={styles.btnText}>📊 Descargar Reporte Excel</Text>
            </TouchableOpacity>

            <TextInput 
                style={styles.input} 
                placeholder="🔍 Buscar docente o área..." 
                value={search} 
                onChangeText={setSearch} 
            />

            <FlatList 
                data={filtered} 
                renderItem={({ item }) => (
                    <RenderFinAnioItem 
                        item={item} 
                        onToggleExpand={(id) => setData(prev => prev.map(p => p.id === id ? { ...p, isExpanded: !p.isExpanded } : p))} 
                    />
                )} 
                keyExtractor={i => i.id} 
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
};

// --- 6. ESTILOS ---
const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, backgroundColor: '#f0f4f7', padding: 10 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 15, color: '#DC3545' },
    btnExcel: { backgroundColor: '#217346', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15, elevation: 3 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
    profesorCardWrapper: { marginBottom: 12 },
    profesorCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, elevation: 2 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerInfo: { flex: 1 },
    nombre: { fontSize: 18, fontWeight: '700', color: '#333' },
    curso: { color: '#666', marginTop: 2 },
    downloadButton: { padding: 5 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' },
    progresoText: { fontWeight: '700', fontSize: 14 },
    expandIcon: { fontSize: 18, color: '#999' },
    statusContainer: { marginTop: 15, padding: 10, borderRadius: 8, borderWidth: 1 },
    statusComplete: { backgroundColor: '#e6ffe6', borderColor: '#28a745' },
    statusIncomplete: { backgroundColor: '#fff8e1', borderColor: '#ffc107' },
    statusTitle: { fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#333' },
    documentoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
    documentoItemActive: { backgroundColor: '#d2f0d2' },
    documentoLabel: { flex: 1, paddingRight: 10, fontSize: 13, color: '#444' }
});