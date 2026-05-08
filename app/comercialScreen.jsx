import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const ComercialScreen = ({ userData, onAdjust }) => {
    const totalDebt = userData?.totalDebt || 0;
    const totalPayment = userData?.totalPayment || 0;
    const totalPorCobrar = totalDebt - totalPayment;

    // Format with commas: 1234.56 → "1,234.56"
    const formatted = Math.abs(totalPorCobrar).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return (
        <View style={styles.statCard}>
            <View style={styles.cardHeader}>
                <Ionicons name="trending-up" size={32} color="#e91212ff" />
                <TouchableOpacity onPress={onAdjust} style={styles.adjustBtn}>
                    <Ionicons name="options-outline" size={16} color="#e91212ff" />
                    <Text style={styles.adjustText}>Ajustar</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.statValue}>${formatted}</Text>
            <Text style={styles.statLabel}>Monto total por cobrar</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    statCard: {
        flex: 1,
        backgroundColor: 'white',
        margin: 8,
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statValue: { fontSize: 20, fontWeight: 'bold', color: '#1C1C1E', marginTop: 8 },
    statLabel: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    adjustBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0', // un fondo rojizo claro que combine
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    adjustText: {
        color: '#e91212ff',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 4,
    }
});

export default ComercialScreen;