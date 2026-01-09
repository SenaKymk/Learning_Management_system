# LMS Mobile (Expo React Native)

Bir Expo (React Native) uygulaması. Node 18.x ile çalıştırın (React Native toolchain için önerilen sürüm). Backend API `EXPO_PUBLIC_API_URL` ile ayarlanır.

## Başlangıç
```bash
cd apps/mobile
npm install   # veya pnpm/yarn
EXPO_PUBLIC_API_URL=http://localhost:4000 npm run start
```

## İçerik
- `App.tsx`: QueryClientProvider + AuthProvider + NavigationContainer.
- `src/api/apiClient.ts`: Web ile aynı endpoint/payload’lar; token/rol AsyncStorage’da.
- `src/navigation/RootNavigator.tsx`: Auth stack + rol bazlı tablar (student/admin).
- `src/screens/`: Login/Register, Courses, CourseDetail (enrollment, materyal upload, modül sıralama, soru bankası, pratik sınav), AdminDashboard, AdminResults, Results (student), SEB (check + kamera/mic izinleri), Profile.

## Notlar
- Kamera/Mikrofon testi için `expo-camera` izinlerini kabul edin; yalnızca önizleme gösterilir, kayıt yapılmaz.
- PDF upload `expo-document-picker` ile; presigned URL’ler `Linking.openURL` ile açılır.
- Derleyici/Metro hatalarında eksik ikon/splash için app.json varsayılanlarını kullanır (özel varlık gerekmez).
