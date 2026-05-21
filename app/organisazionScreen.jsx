import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const OrganisazionScreen = ({ userData, onAdjust }) => {
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
                colors={['#FFFFFF', '#F5F7FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.statCard}
            >
                {/* Accent line at top */}
                <LinearGradient
                    colors={['#4C669F', '#6B8DD6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentLine}
                />

                <View style={styles.cardHeader}>
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={['#E8EEFF', '#D6DEFF']}
                            style={styles.iconBg}
                        >
                            <Ionicons name="wallet" size={24} color="#4C669F" />
                        </LinearGradient>
                    </View>
                    <TouchableOpacity onPress={onAdjust} style={styles.adjustBtn} activeOpacity={0.7}>
                        <Ionicons name="options-outline" size={15} color="#4C669F" />
                        <Text style={styles.adjustText}>Ajustar</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.statLabel}>Total Registrado</Text>
                <Text style={styles.statValue}>${formatted}</Text>

                {/* Decorative dot pattern */}
                <View style={styles.dotRow}>
                    <View style={[styles.dot, { backgroundColor: '#4C669F' }]} />
                    <View style={[styles.dot, { backgroundColor: '#6B8DD6' }]} />
                    <View style={[styles.dot, { backgroundColor: '#A8C0FF' }]} />
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
        backgroundColor: '#E8EEFF',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        gap: 5,
        borderWidth: 1,
        borderColor: '#D6DEFF',
    },
    adjustText: {
        color: '#4C669F',
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

export default OrganisazionScreen;
