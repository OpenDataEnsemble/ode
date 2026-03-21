import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { useAppTheme } from '../contexts/AppThemeContext';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import logo from '../../assets/images/logo.png';

const FORUM_URL = 'https://forum.opendataensemble.org';
const EMAIL_URL = 'mailto:hello@opendataensemble.org';
const GH_URL = 'https://github.com/OpenDataEnsemble';

const HelpScreen: React.FC = () => {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';
  const sectionColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[900] as string);
  const cardBg = themeColors.surface as string;

  const cardStyle = [
    styles.card,
    { borderColor: themeColors.divider as string, backgroundColor: cardBg },
  ];
  const onSurface = { color: themeColors.onSurface as string };

  return (
    <BlurredScreenBackground>
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: themeColors.primary as string,
              borderBottomColor: themeColors.divider as string,
            },
          ]}>
          <View style={styles.logoContainer}>
            <View
              style={[
                styles.logoWrapper,
                { borderColor: themeColors.onPrimary as string },
              ]}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </View>
            <Text
              style={[
                styles.title,
                { color: themeColors.onPrimary as string },
              ]}>
              Help & Support
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollTransparent}
          contentContainerStyle={styles.content}>
          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Implementation assistance
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              If you are looking for professional assistance with implementing a
              project using ODE, you are more than welcome to reach out to the
              team behind ODE on our forum or via email.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(EMAIL_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open email to opendataensemble.org">
              <Text
                style={[
                  styles.cardText,
                  styles.link,
                  { color: themeColors.primary },
                ]}>
                {EMAIL_URL}
              </Text>
            </Pressable>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Community Forum
            </Text>
            <Text style={[styles.cardText, styles.cardTextCentered, onSurface]}>
              We would love to hear your feedback and welcome contributions.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(FORUM_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open forum opendataensemble.org">
              <Text
                style={[
                  styles.cardText,
                  styles.cardTextCentered,
                  styles.link,
                  { color: themeColors.primary },
                ]}>
                {FORUM_URL}
              </Text>
            </Pressable>
            <Text
              style={[
                styles.cardTitle,
                { color: sectionColor },
                { marginTop: odeSpacing.md },
              ]}>
              Find us on GitHub
            </Text>
            <Text style={[styles.cardText, styles.cardTextCentered, onSurface]}>
              You are also welcome to open an issue or pull request on our
              GitHub repository.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(GH_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open GitHub repository">
              <Text
                style={[
                  styles.cardText,
                  styles.link,
                  { color: themeColors.primary },
                ]}>
                {GH_URL}
              </Text>
            </Pressable>
          </View>

          <View style={cardStyle}>
            <Text style={[styles.cardTitle, { color: sectionColor }]}>
              Help & Support
            </Text>
            <Text style={[styles.cardText, { color: themeColors.onSurface }]}>
              If you need help or support you are always welcome to try reaching
              out to our friendly community on the forum.
            </Text>
            <Pressable
              onPress={() => Linking.openURL(FORUM_URL)}
              accessibilityRole="link"
              accessibilityLabel="Open forum opendataensemble.org">
              <Text
                style={[
                  styles.cardText,
                  styles.link,
                  { color: themeColors.primary },
                ]}>
                {FORUM_URL}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </BlurredScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollTransparent: { backgroundColor: 'transparent' },
  header: {
    padding: odeSpacing.md,
    borderBottomWidth: odeBorderWidth.hairline,
    overflow: 'visible',
    alignItems: 'flex-start',
    minHeight: odeScreenHeaderHeight,
    width: '100%',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderRadius: 0,
  },
  title: {
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
    marginBottom: odeSpacing.xs,
    textAlign: 'left',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  content: {
    padding: odeSpacing.md,
    paddingBottom: odeSpacing.xl,
  },
  card: {
    borderRadius: odeRadius.card,
    marginBottom: odeSpacing.md,
    borderWidth: odeBorderWidth.hairline,
    padding: odeSpacing.md,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    marginBottom: odeSpacing.xs,
    textAlign: 'left',
  },
  cardText: {
    fontSize: odeTypography.bodySm,
    lineHeight: 20,
  },
  cardTextCentered: { textAlign: 'left' },
  link: { marginTop: odeSpacing.sm, fontWeight: '600' },
});

export default HelpScreen;
