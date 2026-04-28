import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import FieldScreen from '../screens/FieldScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import WorkersScreen from '../screens/WorkersScreen';
import MoreScreen from '../screens/MoreScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function ProjectsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProjectsList" component={ProjectsScreen} options={{ title: 'Projects' }} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Project' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#C9A84C', tabBarInactiveTintColor: '#6B7280', headerShown: false }}>
      <Tab.Screen name="Field" component={FieldScreen} options={{ tabBarLabel: 'Field' }} />
      <Tab.Screen name="Projects" component={ProjectsStack} options={{ tabBarLabel: 'Projects' }} />
      <Tab.Screen name="Workers" component={WorkersScreen} options={{ tabBarLabel: 'Workers' }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ tabBarLabel: 'More' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="Login" component={LoginScreen} /></Stack.Navigator>}
    </NavigationContainer>
  );
}
