#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 uEyePosition;
uniform vec3 uAbsorption;
uniform float uDisplayNormals;
uniform float uRefractionIndex;

varying vec3 vPosition; // in [-0.5,+0.5]^3

#define MAX 0.49

#INJECT(FACETS_DEFINITION)

void computeIntersectionWithPlane(const vec3 planePoint, const vec3 planeNormal, const vec3 startingPoint, const vec3 startingDirection, inout float currentTheta, inout vec3 currentNormal) {
    float b = dot(startingDirection, planeNormal);
    if (b < 0.0) {
        float theta = dot(planePoint - startingPoint, planeNormal) / b;

        if (theta > 0.0 && currentTheta < theta) {
            vec3 finalPosition = startingPoint + theta * startingDirection;
            if (abs(finalPosition.x) < MAX && abs(finalPosition.y) < MAX && abs(finalPosition.z) < MAX) {
                currentTheta = theta;
                currentNormal = planeNormal;
            }
        }
    }
}

bool isInside(const vec3 planePoint, const vec3 planeNormal, const vec3 position) {
    return dot(planePoint - position, planeNormal) >= -0.00001;
}

float checkNextInternalIntersection(const vec3 planePoint, const vec3 planeNormal, const vec3 position, const vec3 direction, inout float theta, inout vec3 facetNormal) {
    float localTheta = 100000.0;
    float b = dot(direction, planeNormal);
    if (b > 0.0) {
        localTheta = dot(planePoint - position, planeNormal) / b;

        if (localTheta < theta) {
            facetNormal = planeNormal;
            theta = localTheta;
        }
    }
    return theta;
}

float computeInternalIntersection(const vec3 position, const vec3 direction, inout vec3 facetNormal) {
    float theta = 100000.0;
    #INJECT(COMPUTE_INTERNAL_INTERSECTION)
    return theta;
}

vec4 sampleSkybox(const vec3 normal) {
    return vec4(vec3(step(0.7, normal.z) * step(normal.z, 0.8)), 1);
}

void main(void) {
    if (abs(vPosition.x) >= MAX && abs(vPosition.y) >= MAX && abs(vPosition.z) >= MAX) {
        gl_FragColor = vec4(vec3(1, 0, 0), 1);
        return;
    }

    vec3 fromEyeNormalized = normalize(vPosition - uEyePosition);

    float theta = -1.0;
    vec3 facetNormal;

    #INJECT(COMPUTE_ENTRY_POINT)

    if (theta < 0.0) {
        discard;
    }

    vec3 entryPoint = uEyePosition + theta * fromEyeNormalized;
    vec3 reflectedRayAtEntryPoint = reflect(fromEyeNormalized, facetNormal);
    if (!(#INJECT(CHECK_IF_INSIDE))) {
        discard;
    }

    vec3 currentPoint = entryPoint;
    vec3 currentDirection = refract(fromEyeNormalized, facetNormal, 1.0 / uRefractionIndex);
    float totalDepthInside = 0.0;

    const int rayDepth = #INJECT(RAY_DEPTH);
    for (int i = 0; i < rayDepth; i++) {
        theta = computeInternalIntersection(currentPoint, currentDirection, facetNormal);

        totalDepthInside += theta;
        currentPoint += theta * currentDirection;
        currentDirection = reflect(currentDirection, facetNormal);
    }

    vec4 reflectedColor = sampleSkybox(reflectedRayAtEntryPoint);
    vec4 normalAsColor = vec4(vec3(0.5 + 0.5 * facetNormal), 1);
    vec4 color = vec4(exp(-uAbsorption * totalDepthInside), 1);
    gl_FragColor = mix(color, normalAsColor, uDisplayNormals) + reflectedColor;
}