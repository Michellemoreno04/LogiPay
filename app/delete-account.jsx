import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../authContext/authContext';
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig/config';
import { Ionicons } from '@expo/vector-icons';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!password) {
      Alert.alert("Error", "Por favor, introduce tu contraseña.");
      return;
    }

    Alert.alert(
      "Confirmar eliminación",
      "¿Estás completamente seguro? Esta acción es permanente y eliminará todos tus datos de LogiPay.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar definitivamente",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              // 1. Re-autenticar al usuario (Firebase requiere login reciente para borrar cuenta)
              const credential = EmailAuthProvider.credential(user.email, password);
              await reauthenticateWithCredential(auth.currentUser, credential);

              // 2. Eliminar datos de Firestore
              const userRef = doc(db, "users", user.uid);
              await deleteDoc(userRef);

              // 3. Eliminar usuario de Firebase Auth
              await deleteUser(auth.currentUser);

              // 4. Limpiar estado local y redirigir
              Alert.alert("Cuenta eliminada", "Tu cuenta ha sido eliminada correctamente.");

              router.replace('/welcome');
            } catch (error) {
              console.error("Error deleting account:", error);
              let message = "No se pudo eliminar la cuenta.";
              if (error.code === 'auth/wrong-password') {
                message = "La contraseña es incorrecta.";
              } else if (error.code === 'auth/network-request-failed') {
                message = "Error de red. Revisa tu conexión.";
              }
              Alert.alert("Error", message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>

        <View style={styles.iconContainer}>
          <View style={styles.warningCircle}>
            <Ionicons name="trash" size={50} color="#FF3B30" />
          </View>
        </View>

        <Text style={styles.title}>Eliminar cuenta</Text>
        <Text style={styles.subtitle}>
          Esta acción eliminará permanentemente tu perfil, clientes y transacciones. No se puede deshacer.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Introduce tu contraseña para confirmar</Text>
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, loading && styles.disabledButton]}
          onPress={handleDelete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.deleteButtonText}>Confirmar Eliminación</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Volver atrás</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  content: { flex: 1, padding: 30, justifyContent: 'center' },
  backButton: { position: 'absolute', top: 60, left: 20, zIndex: 1 },
  iconContainer: { alignItems: 'center', marginBottom: 25 },
  warningCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF3B301A',
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#8E8E93', textAlign: 'center', marginBottom: 35, lineHeight: 22 },
  inputContainer: { width: '100%', marginBottom: 30 },
  label: { fontSize: 13, fontWeight: '600', color: '#8E8E93', marginBottom: 10, textTransform: 'uppercase' },
  input: {
    width: '100%',
    height: 60,
    backgroundColor: '#F2F2F7',
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1C1C1E'
  },
  deleteButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#FF3B30',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3
  },
  disabledButton: { opacity: 0.6 },
  deleteButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  cancelButton: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'center' },
  cancelButtonText: { color: '#8E8E93', fontSize: 16, fontWeight: '600' }
});
