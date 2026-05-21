import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
        <View style={styles.cardWrapper}>
            <LinearGradient
                colors={['#FFFFFF', '#F8FAFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.statCard}
            >
                {/* Accent line at top */}
                <LinearGradient
                    colors={['#FF4B4B', '#FF7676']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentLine}
                />

                <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={['#FFF0F0', '#FFE0E0']}
                            style={styles.iconBg}
                        >
                            <Ionicons name="trending-up" size={24} color="#FF4B4B" />
                        </LinearGradient>
                    </View>
                    <TouchableOpacity onPress={onAdjust} style={styles.adjustBtn} activeOpacity={0.7}>
                        <Ionicons name="options-outline" size={15} color="#FF4B4B" />
                        <Text style={styles.adjustText}>Ajustar</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.statLabel}>Monto total por cobrar</Text>
                <Text style={styles.statValue}>${formatted}</Text>

                {/* Decorative dot pattern */}
                <View style={styles.dotRow}>
                    <View style={[styles.dot, { backgroundColor: '#FF4B4B' }]} />
                    <View style={[styles.dot, { backgroundColor: '#FF7676' }]} />
                    <View style={[styles.dot, { backgroundColor: '#FFB0B0' }]} />
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    cardWrapper: {
        flex: 1,
        margin: 4,
    },
    statCard: {
        borderRadius: 20,
        padding: 20,
        shadowColor: '#4C669F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 5,
        overflow: 'hidden',
    },
    accentLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {},
    iconBg: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statLabel: {
        fontSize: 13,
        color: '#8E8E93',
        fontWeight: '500',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1F4B',
        letterSpacing: -0.5,
    },
    adjustBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        gap: 5,
        borderWidth: 1,
        borderColor: '#FFE0E0',
    },
    adjustText: {
        color: '#FF4B4B',
        fontSize: 12,
        fontWeight: '700',
    },
    dotRow: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 14,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});

export default ComercialScreen;