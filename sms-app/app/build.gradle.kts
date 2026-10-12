plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "mn.messageparser"
    compileSdk = 35

    defaultConfig {
        applicationId = "mn.messageparser"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Debug түлхүүрээр гарын үсэг зурна — өөрийн утсанд шууд суулгахад хангалттай
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.appcompat)
    implementation(libs.material)
    implementation(libs.recyclerview)
}
